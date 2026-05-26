import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { SuppressionValidationEngine } from './suppression-validation.engine';
import { DangerousEntryAnalysisEngine } from './dangerous-entry-analysis.engine';
import { AcceptanceConfirmationEngine } from './acceptance-confirmation.engine';
import { EntryTimingSimulationEngine } from './entry-timing-simulation.engine';
import { MissedWinnerAnalysisEngine } from './missed-winner-analysis.engine';
import {
  EdgeRefinementReport,
  LiveCandidateFilter,
  SimulationPresetId,
  SuppressionSimulationResult
} from './suppression-validation.models';
import {
  ACCEPTANCE_KEEP_RULES,
  SIMULATION_PRESETS,
  SUPPRESSION_RULES
} from './suppression-rules.util';
import { computePerformanceMetrics } from './suppression-metrics.util';
import { ExecutionQualitySynthesisService } from '../execution-quality/execution-quality-synthesis.service';
import { EntrySequencingSynthesisService } from '../entry-sequencing/entry-sequencing-synthesis.service';
import { ExecutionDecisionSynthesisService } from '../live-decision/execution-decision-synthesis.service';
import { DecisionFeedbackSynthesisService } from '../decision-feedback/decision-feedback-synthesis.service';
import { MarketStateSynthesisService } from '../market-state/market-state-synthesis.service';
import { EntryOptimizationSynthesisService } from '../adaptive-entry/entry-optimization-synthesis.service';
import { AdaptiveCalibrationSynthesisService } from '../adaptive-calibration/adaptive-calibration-synthesis.service';

/** Phase 141 orchestrator — suppression validation & edge refinement (advisory only). */
@Injectable({ providedIn: 'root' })
export class EdgeRefinementReportService {
  private readonly validationEngine = new SuppressionValidationEngine();
  private readonly dangerousEngine = new DangerousEntryAnalysisEngine();
  private readonly acceptanceEngine = new AcceptanceConfirmationEngine();
  private readonly timingEngine = new EntryTimingSimulationEngine();
  private readonly missedEngine = new MissedWinnerAnalysisEngine();

  private readonly reportSubject = new BehaviorSubject<EdgeRefinementReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  private activePreset: SimulationPresetId | null = null;

  constructor(
    private store: SignalIntelligenceStore,
    private executionQuality: ExecutionQualitySynthesisService,
    private entrySequencing: EntrySequencingSynthesisService,
    private decisionFeedback: DecisionFeedbackSynthesisService,
    private marketState: MarketStateSynthesisService,
    private adaptiveEntry: EntryOptimizationSynthesisService,
    private adaptiveCalibration: AdaptiveCalibrationSynthesisService,
    private injector: Injector
  ) {
    this.store.revision$.subscribe(() => this.refresh());
  }

  /** Lazy resolve — breaks DI cycle with ExecutionDecisionSynthesisService. */
  private get liveDecision(): ExecutionDecisionSynthesisService {
    return this.injector.get(ExecutionDecisionSynthesisService);
  }

  snapshot(): EdgeRefinementReport | null {
    return this.reportSubject.value;
  }

  refresh(filter: SignalIntelligenceFilter = {}): EdgeRefinementReport {
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs });
    return this.buildReport(signals, lookbackDays, this.activePreset, filter);
  }

  runPreset(presetId: SimulationPresetId, filter: SignalIntelligenceFilter = {}): EdgeRefinementReport {
    this.activePreset = presetId;
    return this.refresh(filter);
  }

  clearPreset(): EdgeRefinementReport {
    this.activePreset = null;
    return this.refresh();
  }

  presets() {
    return SIMULATION_PRESETS;
  }

  private buildReport(
    signals: ReturnType<SignalIntelligenceStore['query']>,
    lookbackDays: number,
    presetId: SimulationPresetId | null,
    filter: SignalIntelligenceFilter = {}
  ): EdgeRefinementReport {
    const baseline = computePerformanceMetrics(signals);
    let allSimulations = this.validationEngine.simulateAllRules(signals, SUPPRESSION_RULES);

    if (presetId) {
      const preset = SIMULATION_PRESETS.find(p => p.id === presetId)!;
      const composite = this.validationEngine.simulateComposite(
        signals,
        preset.ruleIds,
        preset.label,
        presetId
      );
      allSimulations = [composite, ...allSimulations];
    }

    const bestSuppressions = allSimulations
      .filter(s => s.verdict === 'RECOMMENDED' || (s.verdict === 'MARGINAL' && s.deltas.expectancyR > 0.05))
      .slice(0, 10);

    const overSuppressed = allSimulations.filter(s => s.overSuppressed || s.verdict === 'OVER_SUPPRESSED');
    const missedWinners = this.missedEngine.analyze(allSimulations);
    const dangerousConditions = this.dangerousEngine.analyze(signals);
    const acceptanceResults = this.acceptanceEngine.analyze(signals);
    const entryTiming = this.timingEngine.analyze(signals);
    const liveCandidates = this.buildLiveCandidates(allSimulations, acceptanceResults);
    const eqReport = this.executionQuality.refresh(filter);
    const seqReport = this.entrySequencing.refresh(filter);
    const decisionReport = this.liveDecision.refresh(filter);
    const feedbackReport = this.decisionFeedback.refresh(filter);
    const narrativeReport = this.marketState.refresh(filter);
    const adaptiveEntryReport = this.adaptiveEntry.refresh(filter);
    const adaptiveCalibrationReport = this.adaptiveCalibration.refresh(filter);

    const topComposite = presetId ? allSimulations[0] : bestSuppressions[0];
    const expectedImprovement = topComposite?.deltas.expectancyR ?? 0;
    const tradeReduction = topComposite?.deltas.tradeCountPct ?? 0;

    const report: EdgeRefinementReport = {
      lookbackDays,
      totalEvaluated: baseline.sampleCount,
      generatedAt: Date.now(),
      baseline,
      bestSuppressions,
      dangerousConditions,
      overSuppressed,
      acceptanceResults,
      entryTiming,
      missedWinners,
      liveCandidates,
      expectedExpectancyImprovementR: expectedImprovement,
      tradeReductionPct: Math.abs(tradeReduction),
      allSimulations,
      activePreset: presetId,
      executionQuality: eqReport,
      entrySequencing: seqReport,
      decisionQuality: decisionReport,
      decisionFeedback: feedbackReport,
      marketNarrative: narrativeReport,
      adaptiveEntry: adaptiveEntryReport,
      adaptiveCalibration: adaptiveCalibrationReport,
      advisoryOnly: true
    };

    this.reportSubject.next(report);
    return report;
  }

  private buildLiveCandidates(
    simulations: SuppressionSimulationResult[],
    acceptance: ReturnType<AcceptanceConfirmationEngine['analyze']>
  ): LiveCandidateFilter[] {
    const filters: LiveCandidateFilter[] = [];

    for (const s of simulations.filter(r => r.verdict === 'RECOMMENDED').slice(0, 6)) {
      filters.push({
        id: s.ruleId,
        headline: `${s.ruleLabel} suppression improves expectancy by ${formatR(s.deltas.expectancyR)}`,
        detail: s.advisoryNote,
        expectancyDeltaR: s.deltas.expectancyR,
        qualityScore: s.qualityScore,
        verdict: s.verdict
      });
    }

    for (const d of simulations.filter(r => r.ruleId === 'CHASE_ENTRY' || r.ruleId === 'LATE_ENTRY')) {
      if (d.deltas.expectancyR < -0.3) {
        filters.push({
          id: d.ruleId,
          headline: `${d.ruleLabel} reduce expectancy by ${formatR(d.deltas.expectancyR)}`,
          detail: 'Anti-chase / anti-late rules strongly validated',
          expectancyDeltaR: d.deltas.expectancyR,
          qualityScore: d.qualityScore,
          verdict: d.verdict
        });
      }
    }

    for (const a of acceptance.filter(r => r.deltaR > 0.1 && r.fakeoutImprovement > 5).slice(0, 3)) {
      filters.push({
        id: a.id,
        headline: `Waiting for ${a.label} improves fakeout rate by ${a.fakeoutImprovement.toFixed(0)}%`,
        detail: `Expectancy ${formatR(a.instantExpectancyR)} → ${formatR(a.confirmedExpectancyR)}`,
        expectancyDeltaR: a.deltaR,
        qualityScore: 70,
        verdict: 'RECOMMENDED'
      });
    }

    return dedupeFilters(filters).slice(0, 10);
  }
}

function formatR(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
}

function dedupeFilters(items: LiveCandidateFilter[]): LiveCandidateFilter[] {
  const seen = new Set<string>();
  return items.filter(i => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}
