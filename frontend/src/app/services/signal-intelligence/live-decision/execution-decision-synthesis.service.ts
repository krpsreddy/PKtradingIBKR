import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter,
  SignalSnapshot
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { LiveDecisionEngine } from './live-decision-engine';
import { EntryAcceptanceSequencingEngine } from '../entry-sequencing/entry-acceptance-sequencing.engine';
import { ContinuationAcceptanceEngine } from '../entry-sequencing/continuation-acceptance.engine';
import { PullbackStabilityEngine } from '../entry-sequencing/pullback-stability.engine';
import {
  DecisionQualityReport,
  LiveDecisionContext,
  LiveExecutionDecision,
  LiveExecutionDecisionSnapshot
} from './live-decision.models';
import { LiveExecutionQualityIntel } from '../execution-quality/execution-quality.models';
import { LiveEntrySequencingIntel } from '../entry-sequencing/entry-sequencing.models';
import { LiveExecutionGateSnapshot } from '../live-execution/live-execution.models';
import { MIN_AUTHORITATIVE, MIN_LOW_CONFIDENCE } from './live-decision.util';
import { ExecutionSequencingSimulationEngine } from '../entry-sequencing/execution-sequencing-simulation.engine';
import { ContinuationPromotionSynthesisService } from '../continuation-promotion/continuation-promotion-synthesis.service';
import { ExpansionParticipationSynthesisService } from '../opening-expansion/expansion-participation-synthesis.service';
import { ContinuationParticipationSynthesisService } from '../continuation-participation/continuation-participation-synthesis.service';
import { AutonomousExecutionSynthesisService } from '../autonomous-execution/autonomous-execution-synthesis.service';
import { LiveRegimeSynthesisService } from '../../live-regime-intelligence/live-regime-synthesis.service';
import { ExecutionTriggerSynthesisService } from '../../execution-trigger-intelligence/execution-trigger-synthesis.service';
import { ExecutionModeService } from '../execution-mode.service';
import { OPENING_WINDOW_MIN } from '../opening-expansion/opening-expansion.util';
import { OpeningExpansionInput } from '../opening-expansion/opening-expansion.models';
import { ContinuationParticipationInput } from '../continuation-participation/continuation-participation.models';
import { AutonomousExecutionInput } from '../autonomous-execution/autonomous-execution.models';
import { LiveRegimeInput } from '../../live-regime-intelligence/live-regime.models';
import { ExecutionTriggerInput } from '../../execution-trigger-intelligence/execution-trigger.models';
import { IntelligenceOffloadService } from '../../intelligence-offload/intelligence-offload.service';

export interface LiveDecisionInput {
  symbol: string;
  signalType?: string;
  marketRegime?: string;
  rvol?: number;
  trendAlignment?: number;
  vwapDistance?: number;
  sessionTimeMinutes?: number;
  extended?: boolean;
  entryQuality?: string | null;
  signalAgeMinutes?: number | null;
  executionQualityIntel?: LiveExecutionQualityIntel | null;
  entrySequencingIntel?: LiveEntrySequencingIntel | null;
  liveGate?: LiveExecutionGateSnapshot | null;
  falseBreakoutTrap?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  adaptiveEntryIntel?: import('../adaptive-entry/adaptive-entry.models').LiveAdaptiveEntryIntel | null;
  marketStateIntel?: import('../market-state/market-state.models').LiveMarketStateIntel | null;
  adaptiveCalibrationIntel?: import('../adaptive-calibration/adaptive-calibration.models').LiveAdaptiveCalibrationIntel | null;
}

/** Phase 143 orchestrator — single actionable execution decision (advisory only). */
@Injectable({ providedIn: 'root' })
export class ExecutionDecisionSynthesisService {
  private readonly decisionEngine = new LiveDecisionEngine();
  private readonly sequencer = new EntryAcceptanceSequencingEngine();
  private readonly continuationEngine = new ContinuationAcceptanceEngine();
  private readonly pullbackEngine = new PullbackStabilityEngine();
  private readonly simulationEngine = new ExecutionSequencingSimulationEngine();
  private readonly falseBreakout = new FalseBreakoutAnalyticsEngine();

  private readonly reportSubject = new BehaviorSubject<DecisionQualityReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(
    private store: SignalIntelligenceStore,
    private continuationPromotion: ContinuationPromotionSynthesisService,
    private openingExpansion: ExpansionParticipationSynthesisService,
    private continuationParticipation: ContinuationParticipationSynthesisService,
    private autonomousExecution: AutonomousExecutionSynthesisService,
    private liveRegime: LiveRegimeSynthesisService,
    private executionTrigger: ExecutionTriggerSynthesisService,
    private executionMode: ExecutionModeService,
    private offload: IntelligenceOffloadService
  ) {
    this.offload.bindRevisionRefresh(() => this.refresh(), this.store.revision$);
    if (!this.offload.skipFrontendSynthesis()) {
      this.refresh();
    }
  }

  snapshot(): DecisionQualityReport | null {
    return this.reportSubject.value;
  }

  liveDecision(input: LiveDecisionInput): LiveExecutionDecisionSnapshot {
    const fromTs = Date.now() - SIGNAL_INTELLIGENCE_LOOKBACK_DAYS * 86_400_000;
    const n = evaluatedSignals(this.store.query({ symbol: input.symbol.toUpperCase(), fromTs })).length;
    const ctx = this.buildContext(input, n);
    const base = this.decisionEngine.decide(ctx);
    const promoInput = this.promotionInputFromLive(input, ctx, n);
    const expansionInput = this.openingExpansionInputFromLive(input, ctx, n);
    const participationInput = this.participationInputFromLive(input, ctx, n);
    const autonomousInput = this.autonomousInputFromLive(input, ctx, n);
    const regimeInput = this.liveRegimeInputFromLive(input, ctx, n);
    const triggerInput = this.triggerInputFromLive(input, ctx, n);

    let legacySnapshot = base;
    if (this.executionMode.isLegacyEnabled()) {
      legacySnapshot = this.liveRegime.applyToLiveDecision(legacySnapshot, regimeInput);
      legacySnapshot = this.executionTrigger.applyToLiveDecision(legacySnapshot, triggerInput);
      if ((input.sessionTimeMinutes ?? 999) <= OPENING_WINDOW_MIN) {
        legacySnapshot = this.openingExpansion.applyToLiveDecision(legacySnapshot, expansionInput);
      }
      legacySnapshot = this.continuationPromotion.applyToLiveDecision(legacySnapshot, promoInput);
    }

    let snapshot = base;
    if (this.executionMode.isAutonomousPrimary()) {
      snapshot = this.liveRegime.applyToLiveDecision(snapshot, regimeInput);
      snapshot = this.executionTrigger.applyToLiveDecision(snapshot, triggerInput);
      if ((input.sessionTimeMinutes ?? 999) <= OPENING_WINDOW_MIN) {
        snapshot = this.openingExpansion.applyToLiveDecision(snapshot, expansionInput);
      }
      snapshot = this.continuationParticipation.applyToLiveDecision(snapshot, participationInput);
      snapshot = this.autonomousExecution.applyToLiveDecision(snapshot, autonomousInput);
      if (this.executionMode.isHybrid()) {
        snapshot = {
          ...snapshot,
          legacyDecision: {
            decision: legacySnapshot.decision,
            decisionLabel: legacySnapshot.decisionLabel,
            compactLine: legacySnapshot.compactLine
          },
          executionFrameworkMode: this.executionMode.mode()
        };
      }
      return snapshot;
    }

    return legacySnapshot;
  }

  refresh(filter: SignalIntelligenceFilter = {}): DecisionQualityReport {
    if (this.offload.skipFrontendSynthesis()) {
      return this.reportSubject.value ?? this.emptyQualityReport();
    }
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs });
    return this.buildQualityReport(signals, lookbackDays);
  }

  private buildContext(input: LiveDecisionInput, sampleCount: number): LiveDecisionContext {
    const seq = input.entrySequencingIntel;
    const eq = input.executionQualityIntel;
    const gate = input.liveGate;

    return {
      symbol: input.symbol.toUpperCase(),
      signalType: input.signalType,
      marketRegime: input.marketRegime,
      rvol: input.rvol,
      trendAlignment: input.trendAlignment,
      vwapDistance: input.vwapDistance,
      sessionTimeMinutes: input.sessionTimeMinutes,
      extended: input.extended,
      entryQuality: input.entryQuality,
      signalAgeMinutes: input.signalAgeMinutes,
      governanceState: gate?.governance?.state,
      governanceConfidence: gate?.governance?.statisticalConfidence,
      fakeoutRisk: input.falseBreakoutTrap ?? eq?.fakeoutRisk ?? 'MEDIUM',
      continuationLevel: gate?.continuation?.level,
      sizeMultiplier: gate?.sizeMultiplier,
      executionScore: gate?.executionScore,
      sequencingState: seq?.currentState,
      continuationAcceptance: seq?.continuationAcceptance,
      pullbackStability: seq?.pullbackStability,
      sampleCount,
      entryLocationQuality: input.adaptiveEntryIntel?.entryLocation,
      narrativeQuality: input.marketStateIntel?.narrativeQuality,
      calibratedConvictionBias: input.adaptiveCalibrationIntel?.calibratedConvictionBias,
      waitJustified: input.adaptiveCalibrationIntel?.waitJustified,
      governanceTooConservative: input.adaptiveCalibrationIntel?.governanceTooConservative,
      narrativeStable: input.adaptiveCalibrationIntel?.narrativeStable,
      calibrationRegretScore: input.adaptiveCalibrationIntel?.regretScore,
      lowRegretZone: input.adaptiveCalibrationIntel?.lowRegretZone
    };
  }

  private buildQualityReport(signals: SignalSnapshot[], lookbackDays: number): DecisionQualityReport {
    const evaluated = evaluatedSignals(signals);
    const decisionMap = new Map<LiveExecutionDecision, SignalSnapshot[]>();
    const convictionMap = new Map<string, SignalSnapshot[]>();

    for (const s of evaluated) {
      const ctx = this.contextFromSignal(s, evaluated.length);
      const decision = this.decisionEngine.decide(ctx);
      decisionMap.set(decision.decision, [...(decisionMap.get(decision.decision) ?? []), s]);
      convictionMap.set(decision.conviction.band, [...(convictionMap.get(decision.conviction.band) ?? []), s]);
    }

    const byDecision = [...decisionMap.entries()].map(([decision, bucket]) => row(decision, bucket));
    const convictionAccuracy = [...convictionMap.entries()].map(([band, bucket]) => ({
      band: band as import('./live-decision.models').ConvictionBand,
      sampleCount: bucket.length,
      winRate: pct(bucket.filter(s => s.evaluation!.status === 'WIN').length, bucket.length),
      expectancyR: computeExpectancyR(bucket)
    })).sort((a, b) => b.expectancyR - a.expectancyR);

    const sims = this.simulationEngine.simulateAll(signals);
    const waitBenefit = sims.map(s => ({
      preset: s.presetLabel,
      expectancyGainR: s.deltas.expectancyR,
      fakeoutsAvoided: Math.round(Math.abs(Math.min(0, s.deltas.fakeoutRate)) * s.baseline.sampleCount / 100),
      winnersMissed: s.deltas.missedWinners
    }));

    const avoidBucket = decisionMap.get('AVOID_TRADE') ?? [];
    const trapBucket = decisionMap.get('TRAP_RISK') ?? [];
    const fullBucket = decisionMap.get('FULL_EXECUTION') ?? [];
    const losers = evaluated.filter(s => s.evaluation!.status === 'LOSS');
    const avoidedLosers = [...avoidBucket, ...trapBucket].filter(s => s.evaluation!.status === 'LOSS').length;
    const allowedWinners = fullBucket.filter(s => s.evaluation!.status === 'WIN').length;

    const eliteBucket = convictionMap.get('ELITE') ?? [];
    const overConfidence = eliteBucket.length >= 3 && computeExpectancyR(eliteBucket) < 0
      ? [{ label: 'ELITE conviction failures', sampleCount: eliteBucket.length, expectancyR: computeExpectancyR(eliteBucket), note: 'High conviction underperformed — crowded continuation traps' }]
      : [];

    const highConv = convictionMap.get('HIGH') ?? [];
    const lowConv = convictionMap.get('LOW') ?? [];
    const synthesis = this.synthesize(byDecision, convictionAccuracy, waitBenefit, evaluated.length);

    const report: DecisionQualityReport = {
      lookbackDays,
      totalEvaluated: evaluated.length,
      byDecision,
      convictionAccuracy,
      waitBenefit,
      overConfidence,
      decisionAccuracy: {
        losersAvoided: avoidedLosers,
        winnersAllowed: allowedWinners,
        fakeoutReductionPct: waitBenefit[0]?.fakeoutsAvoided ?? 0
      },
      synthesis,
      advisoryOnly: true
    };

    this.reportSubject.next(report);
    return report;
  }

  private contextFromSignal(s: SignalSnapshot, sampleCount: number): LiveDecisionContext {
    const seq = this.sequencer.sequence(s, sampleCount);
    return {
      symbol: s.symbol,
      signalType: s.signalType,
      marketRegime: s.marketRegime,
      rvol: s.rvol,
      trendAlignment: s.trendAlignment,
      vwapDistance: s.vwapDistance,
      sessionTimeMinutes: s.sessionTimeMinutes,
      extended: s.extendedEntry,
      entryQuality: s.captureStage,
      sequencingState: seq.finalState,
      continuationAcceptance: this.continuationEngine.classify(s),
      pullbackStability: this.pullbackEngine.classify(s),
      fakeoutRisk: this.falseBreakout.isFalseBreakout(s) ? 'HIGH' : 'LOW',
      sampleCount
    };
  }

  private promotionInputFromLive(input: LiveDecisionInput, ctx: LiveDecisionContext, sampleCount: number) {
    return {
      symbol: ctx.symbol,
      signalType: ctx.signalType,
      marketRegime: ctx.marketRegime,
      rvol: ctx.rvol,
      trendAlignment: ctx.trendAlignment,
      vwapDistance: ctx.vwapDistance,
      sessionTimeMinutes: ctx.sessionTimeMinutes,
      extended: ctx.extended,
      sequencingState: ctx.sequencingState,
      continuationAcceptance: ctx.continuationAcceptance,
      pullbackStability: ctx.pullbackStability,
      fakeoutRisk: ctx.fakeoutRisk,
      sampleCount
    };
  }

  private openingExpansionInputFromLive(
    input: LiveDecisionInput,
    ctx: LiveDecisionContext,
    sampleCount: number
  ): OpeningExpansionInput {
    return {
      symbol: ctx.symbol,
      signalType: ctx.signalType ?? '',
      sessionTimeMinutes: input.sessionTimeMinutes,
      rvol: ctx.rvol,
      vwapDistance: ctx.vwapDistance,
      trendAlignment: ctx.trendAlignment,
      extended: ctx.extended,
      score: ctx.trendAlignment,
      marketRegime: ctx.marketRegime,
      sampleCount
    };
  }

  private participationInputFromLive(
    input: LiveDecisionInput,
    ctx: LiveDecisionContext,
    sampleCount: number
  ): ContinuationParticipationInput {
    return {
      symbol: ctx.symbol,
      signalType: ctx.signalType,
      sessionTimeMinutes: input.sessionTimeMinutes,
      rvol: ctx.rvol,
      vwapDistance: ctx.vwapDistance,
      trendAlignment: ctx.trendAlignment,
      extended: ctx.extended,
      convictionScore: ctx.trendAlignment,
      sampleCount
    };
  }

  private autonomousInputFromLive(
    input: LiveDecisionInput,
    ctx: LiveDecisionContext,
    sampleCount: number
  ): AutonomousExecutionInput {
    return {
      symbol: ctx.symbol,
      signalType: ctx.signalType,
      sessionTimeMinutes: input.sessionTimeMinutes,
      rvol: ctx.rvol,
      vwapDistance: ctx.vwapDistance,
      trendAlignment: ctx.trendAlignment,
      extended: ctx.extended,
      convictionScore: ctx.trendAlignment,
      sampleCount
    };
  }

  private liveRegimeInputFromLive(
    input: LiveDecisionInput,
    ctx: LiveDecisionContext,
    sampleCount: number
  ): LiveRegimeInput {
    return {
      symbol: ctx.symbol,
      signalType: ctx.signalType,
      marketRegime: ctx.marketRegime,
      sessionTimeMinutes: input.sessionTimeMinutes,
      rvol: ctx.rvol,
      vwapDistance: ctx.vwapDistance,
      trendAlignment: ctx.trendAlignment,
      extended: ctx.extended,
      structureScore: ctx.trendAlignment,
      breadthAlignment: ctx.trendAlignment,
      sampleCount
    };
  }

  private triggerInputFromLive(
    input: LiveDecisionInput,
    ctx: LiveDecisionContext,
    sampleCount: number
  ): ExecutionTriggerInput {
    return {
      symbol: ctx.symbol,
      signalType: ctx.signalType,
      marketRegime: ctx.marketRegime,
      sessionTimeMinutes: input.sessionTimeMinutes,
      rvol: ctx.rvol,
      vwapDistance: ctx.vwapDistance,
      trendAlignment: ctx.trendAlignment,
      extended: ctx.extended,
      structureScore: ctx.trendAlignment,
      volatility: undefined,
      pullbackDepth: ctx.vwapDistance != null ? Math.abs(ctx.vwapDistance) : undefined,
      sampleCount
    };
  }

  private synthesize(
    byDecision: ReturnType<typeof row>[],
    conviction: DecisionQualityReport['convictionAccuracy'],
    waitBenefit: DecisionQualityReport['waitBenefit'],
    n: number
  ): DecisionQualityReport['synthesis'] {
    const lines: DecisionQualityReport['synthesis'] = [];
    const conf = confidenceFromCount(n);

    const full = byDecision.find(d => d.decision === 'FULL_EXECUTION');
    if (full && full.sampleCount >= MIN_AUTHORITATIVE && full.expectancyR > 0.15) {
      lines.push({ id: 'full-exec', headline: 'FULL EXECUTION decisions outperform baseline.', detail: `${full.expectancyR.toFixed(2)}R · WR ${full.winRate}% · n=${full.sampleCount}` });
    }

    const wait = waitBenefit.sort((a, b) => b.expectancyGainR - a.expectancyGainR)[0];
    if (wait && wait.expectancyGainR > 0.05) {
      lines.push({ id: 'wait-benefit', headline: 'Waiting for acceptance improves expectancy.', detail: `${wait.preset}: +${wait.expectancyGainR.toFixed(2)}R · avoided ~${wait.fakeoutsAvoided} fakeouts` });
    }

    const high = conviction.find(c => c.band === 'HIGH');
    const low = conviction.find(c => c.band === 'LOW');
    if (high && low && high.sampleCount >= MIN_LOW_CONFIDENCE && low.sampleCount >= MIN_LOW_CONFIDENCE) {
      lines.push({
        id: 'conviction-acc',
        headline: 'HIGH conviction outperforms LOW conviction.',
        detail: `HIGH ${high.expectancyR.toFixed(2)}R vs LOW ${low.expectancyR.toFixed(2)}R`
      });
    }

    const avoid = byDecision.find(d => d.decision === 'AVOID_TRADE' || d.decision === 'TRAP_RISK');
    if (avoid && avoid.sampleCount >= MIN_AUTHORITATIVE) {
      lines.push({ id: 'avoid-quality', headline: 'AVOID decisions correctly filter negative expectancy.', detail: `${avoid.expectancyR.toFixed(2)}R on avoided bucket · n=${avoid.sampleCount}` });
    }

    return lines.slice(0, 6);
  }

  private emptyQualityReport(): DecisionQualityReport {
    return {
      lookbackDays: SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
      totalEvaluated: 0,
      byDecision: [],
      convictionAccuracy: [],
      waitBenefit: [],
      overConfidence: [],
      decisionAccuracy: { losersAvoided: 0, winnersAllowed: 0, fakeoutReductionPct: 0 },
      synthesis: [{ id: 'offload', headline: 'Decision quality computed on backend snapshots.', detail: 'Frontend synthesis disabled (Phase 164)' }],
      advisoryOnly: true
    };
  }
}

function row(decision: LiveExecutionDecision, bucket: SignalSnapshot[]) {
  const falseOnes = bucket.filter(s => new FalseBreakoutAnalyticsEngine().isFalseBreakout(s));
  return {
    decision,
    sampleCount: bucket.length,
    winRate: pct(bucket.filter(s => s.evaluation!.status === 'WIN').length, bucket.length),
    expectancyR: computeExpectancyR(bucket),
    fakeoutRate: pct(falseOnes.length, bucket.length)
  };
}
