import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { evaluatedSignals } from '../signal-intelligence.math';
import { DecisionFeedbackEngine } from './decision-feedback.engine';
import { WaitVsActEngine } from './wait-vs-act.engine';
import { DecisionRegretEngine } from './decision-regret.engine';
import { ConvictionCalibrationEngine } from './conviction-calibration.engine';
import { DecisionConsistencyEngine } from './decision-consistency.engine';
import { AdaptiveDecisionObservationEngine } from './adaptive-decision-observation.engine';
import { DecisionReliabilityScoreEngine } from './decision-reliability-score.engine';
import {
  DecisionFeedbackReport,
  EngineConfidenceLine,
  EngineConfidenceSnapshot,
  LiveDecisionFeedbackIntel
} from './decision-feedback.models';
import { MIN_AUTHORITATIVE, MIN_LOW_CONFIDENCE } from './decision-feedback.util';

/** Phase 144 orchestrator — self-auditing decision feedback (advisory only). */
@Injectable({ providedIn: 'root' })
export class DecisionFeedbackSynthesisService {
  private readonly feedbackEngine = new DecisionFeedbackEngine();
  private readonly waitVsActEngine = new WaitVsActEngine();
  private readonly regretEngine = new DecisionRegretEngine();
  private readonly calibrationEngine = new ConvictionCalibrationEngine();
  private readonly consistencyEngine = new DecisionConsistencyEngine();
  private readonly observationEngine = new AdaptiveDecisionObservationEngine();
  private readonly reliabilityEngine = new DecisionReliabilityScoreEngine();

  private readonly reportSubject = new BehaviorSubject<DecisionFeedbackReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(private store: SignalIntelligenceStore) {
    this.store.revision$.subscribe(() => this.refresh());
  }

  snapshot(): DecisionFeedbackReport | null {
    return this.reportSubject.value;
  }

  refresh(filter: SignalIntelligenceFilter = {}): DecisionFeedbackReport {
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs });
    return this.buildReport(signals, lookbackDays);
  }

  liveIntel(symbol: string, regime?: string): LiveDecisionFeedbackIntel {
    const fromTs = Date.now() - SIGNAL_INTELLIGENCE_LOOKBACK_DAYS * 86_400_000;
    const signals = this.store.query({ symbol: symbol.toUpperCase(), fromTs });
    const report = this.snapshot() ?? this.buildReport(signals, SIGNAL_INTELLIGENCE_LOOKBACK_DAYS);
    const n = evaluatedSignals(signals).length;
    const engineConfidence = this.buildEngineConfidence(report, regime, n);
    const adaptiveInsightLine = this.pickAdaptiveLine(report, n);

    return {
      adaptiveInsightLine,
      engineConfidence,
      authoritative: n >= MIN_AUTHORITATIVE,
      advisoryOnly: true
    };
  }

  private buildReport(signals: ReturnType<SignalIntelligenceStore['query']>, lookbackDays: number): DecisionFeedbackReport {
    const evaluated = evaluatedSignals(signals);
    const { rows, accuracy } = this.feedbackEngine.analyze(signals);
    const waitVsAct = this.waitVsActEngine.analyze(signals);
    const regret = this.regretEngine.analyze(signals);
    const convictionCalibration = this.calibrationEngine.analyze(signals);
    const consistency = this.consistencyEngine.analyze(signals);
    const reliabilityScores = this.reliabilityEngine.score(signals, consistency);

    const partial = {
      lookbackDays,
      totalEvaluated: evaluated.length,
      accuracy,
      auditedSample: rows.slice(0, 200),
      waitVsAct,
      regret,
      convictionCalibration,
      consistency,
      reliabilityScores,
      engineConfidence: { lines: [], performingWell: false, advisoryOnly: true as const },
      advisoryOnly: true as const
    };

    const observations = this.observationEngine.observe(partial, evaluated.length);
    const engineConfidence = this.buildEngineConfidence(
      { ...partial, observations, synthesis: [], adaptiveInsightLine: null, advisoryOnly: true },
      undefined,
      evaluated.length
    );
    const adaptiveInsightLine = this.pickAdaptiveLine(
      { ...partial, observations, engineConfidence, synthesis: [], adaptiveInsightLine: null, advisoryOnly: true },
      evaluated.length
    );
    const synthesis = observations.slice(0, 6).map(o => ({
      id: o.id,
      headline: o.headline,
      detail: o.detail
    }));

    const report: DecisionFeedbackReport = {
      ...partial,
      observations,
      engineConfidence,
      adaptiveInsightLine,
      synthesis,
      advisoryOnly: true
    };

    this.reportSubject.next(report);
    return report;
  }

  private buildEngineConfidence(
    report: DecisionFeedbackReport,
    regime: string | undefined,
    n: number
  ): EngineConfidenceSnapshot {
    const lines: EngineConfidenceLine[] = [];
    if (n < MIN_AUTHORITATIVE) {
      return { lines: [], performingWell: false, advisoryOnly: true };
    }

    const bestRel = report.reliabilityScores[0];
    if (bestRel && bestRel.score >= 55) {
      lines.push({
        id: 'performing',
        headline: `Decision engine performing well on ${bestRel.label} (${bestRel.score}/100).`,
        tone: 'POSITIVE'
      });
    }

    const overstated = report.convictionCalibration.points.find(p => p.reliability === 'OVERSTATED');
    if (overstated) {
      lines.push({
        id: 'conv-over',
        headline: `Conviction overstated in ${overstated.band.toLowerCase()} conditions.`,
        tone: 'WARNING'
      });
    }

    const waitBest = report.waitVsAct.comparisons.find(c => c.expectancyImprovementR > 0.05);
    if (waitBest) {
      lines.push({
        id: 'wait-out',
        headline: 'Wait logic currently outperforming aggressive execution.',
        tone: 'POSITIVE'
      });
    }

    if (regime) {
      const regimeAcc = report.accuracy.filter(a => a.sampleCount >= MIN_LOW_CONFIDENCE);
      if (regimeAcc.length) {
        lines.push({
          id: 'regime',
          headline: `Decision engine calibrated for ${regime.replace(/_/g, ' ')} environments.`,
          tone: 'NEUTRAL'
        });
      }
    }

    if (report.regret.regretScore > 40 && n >= MIN_LOW_CONFIDENCE) {
      lines.push({
        id: 'regret',
        headline: 'Governance may be over-conservative — review regret metrics.',
        tone: 'WARNING'
      });
    }

    return {
      lines: lines.slice(0, 4),
      performingWell: (bestRel?.score ?? 0) >= 60 && report.regret.regretScore < 35,
      advisoryOnly: true
    };
  }

  private pickAdaptiveLine(report: DecisionFeedbackReport, n: number): string | null {
    if (n < MIN_AUTHORITATIVE) return null;

    const wait = report.waitVsAct.comparisons.find(c => c.expectancyImprovementR > 0.05);
    if (wait && n >= MIN_LOW_CONFIDENCE) {
      return `Historical WAIT decisions outperform immediate execution by +${wait.expectancyImprovementR.toFixed(2)}R.`;
    }

    const trap = report.accuracy.find(a => a.decision === 'TRAP_RISK' && a.correctAvoidanceRate !== undefined);
    if (trap && trap.sampleCount >= MIN_AUTHORITATIVE) {
      return `TRAP_RISK avoided ${trap.correctAvoidanceRate!.toFixed(0)}% of failed continuations.`;
    }

    const pullback = report.waitVsAct.comparisons.find(c => c.strategyId === 'WAIT_FOR_PULLBACK');
    if (pullback && pullback.fakeoutReductionPct > 5) {
      return `Pullback waits reduce fakeouts by ${pullback.fakeoutReductionPct.toFixed(0)}%.`;
    }

    const top = report.observations[0];
    if (top && n >= MIN_LOW_CONFIDENCE) return top.headline;

    return null;
  }
}
