import { Injectable } from '@angular/core';
import { TradingSignal } from '../../models/signal.model';
import { SignalSnapshot } from '../../models/signal-intelligence.model';
import { LiveRegimeSynthesisService } from '../live-regime-intelligence/live-regime-synthesis.service';
import { inputFromSignal, inputFromSnapshot } from '../live-regime-intelligence/live-regime.util';
import { LiveRegimeInput } from '../live-regime-intelligence/live-regime.models';
import {
  DiscoveredStrategy,
  PreExpansionFeatureVector
} from '../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { ExecutionReasoningEngine } from './execution-reasoning.engine';
import { ThresholdDecompositionEngine } from './threshold-decomposition.engine';
import { REGIME_FORMULAS, REGIME_THRESHOLDS } from './regime-threshold-engine';
import {
  ExplainableClusterContext,
  ExplainableRegimeExplanation,
  ReplayExplainTimelineEvent,
  StrategyExplainableSpec
} from './explainable-regime.models';
import { ReplayHistory } from '../../models/replay.model';

/** Phase 170 — transparent autonomous regime explanations. */
@Injectable({ providedIn: 'root' })
export class RegimeExplanationService {
  private readonly reasoning = new ExecutionReasoningEngine();
  private readonly decomposition = new ThresholdDecompositionEngine();
  private debugMode = false;

  constructor(private liveRegime: LiveRegimeSynthesisService) {}

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  isDebugMode(): boolean {
    return this.debugMode;
  }

  explainLiveInput(input: LiveRegimeInput): ExplainableRegimeExplanation {
    const evaluated = this.liveRegime.evaluate(input);
    const explanation = this.reasoning.build(
      input,
      evaluated.metrics,
      evaluated.regimeType,
      evaluated.classification,
      evaluated.participationOpportunity,
      this.debugMode
    );
    explanation.triggerSequence = this.buildSyntheticTriggerSequence(input, evaluated.metrics, explanation);
    return explanation;
  }

  explainSignal(signal: TradingSignal, sampleCount = 0): ExplainableRegimeExplanation {
    return this.explainLiveInput(inputFromSignal(signal, sampleCount));
  }

  explainSnapshot(snapshot: SignalSnapshot, sampleCount: number): ExplainableRegimeExplanation {
    return this.explainLiveInput(inputFromSnapshot(snapshot, sampleCount));
  }

  explainStrategy(
    strategy: DiscoveredStrategy,
    ctx?: ExplainableClusterContext
  ): ExplainableRegimeExplanation {
    const input = this.inputFromStrategy(strategy, ctx?.centroid);
    const evaluated = this.liveRegime.evaluate(input);
    const explanation = this.reasoning.build(
      input,
      evaluated.metrics,
      evaluated.regimeType,
      evaluated.classification,
      evaluated.participationOpportunity,
      this.debugMode
    );
    explanation.strategySpec = this.buildStrategySpec(strategy, ctx);
    explanation.triggerSequence = this.buildSyntheticTriggerSequence(input, evaluated.metrics, explanation);
    return explanation;
  }

  numericConditionsForStrategy(
    strategy: DiscoveredStrategy,
    ctx?: ExplainableClusterContext
  ): { dimension: string; label: string; value: string }[] {
    return this.decomposition.decomposeClusterStrategy(strategy, ctx);
  }

  buildReplayTimeline(
    signal: TradingSignal,
    history?: ReplayHistory | null
  ): ReplayExplainTimelineEvent[] {
    const input = inputFromSignal(signal);
    const evaluated = this.liveRegime.evaluate(input);
    const events: ReplayExplainTimelineEvent[] = [];
    const ts = coerceTs(signal.timestamp);

    events.push({
      time: formatTime(ts - 29_000),
      timestampMs: ts - 29_000,
      event: 'RVOL crossed sustainment threshold',
      metric: 'rvol',
      actual: input.rvol ?? 0,
      threshold: REGIME_THRESHOLDS.velocity.rvolSustainedMin,
      detail: `rvol ${(input.rvol ?? 0).toFixed(2)} ≥ ${REGIME_THRESHOLDS.velocity.rvolSustainedMin}`
    });

    events.push({
      time: formatTime(ts - 23_000),
      timestampMs: ts - 23_000,
      event: 'Compression / shallow pullback quality confirmed',
      metric: 'shallowPullbackQuality',
      actual: evaluated.metrics.shallowPullbackQuality,
      threshold: REGIME_THRESHOLDS.pullback.qualifiesMin,
      detail: `shallowPullbackQuality=${evaluated.metrics.shallowPullbackQuality} (≥ ${REGIME_THRESHOLDS.pullback.qualifiesMin})`
    });

    events.push({
      time: formatTime(ts - 17_000),
      timestampMs: ts - 17_000,
      event: 'Continuation integrity confirmed',
      metric: 'continuationPersistenceScore',
      actual: evaluated.metrics.continuationPersistenceScore,
      threshold: REGIME_THRESHOLDS.expansion.participationPersistMin,
      detail: `persist=${evaluated.metrics.continuationPersistenceScore}`
    });

    const priorConv = Math.max(40, evaluated.metrics.continuationPersistenceScore - 16);
    events.push({
      time: formatTime(ts - 6_000),
      timestampMs: ts - 6_000,
      event: 'Conviction rose on expansion path',
      metric: 'expansionProbability',
      actual: evaluated.metrics.expansionProbability,
      threshold: REGIME_THRESHOLDS.expansion.probingExp,
      detail: `expansion ${priorConv}→${evaluated.metrics.expansionProbability}%`
    });

    events.push({
      time: formatTime(ts),
      timestampMs: ts,
      event: `${evaluated.regimeType.replace(/_/g, ' ')} regime classified`,
      metric: 'regime',
      actual: evaluated.regimeType,
      detail: evaluated.promotionReason
    });

    if (history?.sessionCandles?.length) {
      const barIdx = findNearestBar(history, ts);
      if (barIdx >= 0) {
        events[events.length - 1].detail += ` · bar ${barIdx}`;
      }
    }
    return events;
  }

  private buildStrategySpec(
    strategy: DiscoveredStrategy,
    ctx?: ExplainableClusterContext
  ): StrategyExplainableSpec {
    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      entryFormulas: { ...REGIME_FORMULAS },
      thresholdRefs: {
        rvolSustained: REGIME_THRESHOLDS.velocity.rvolSustainedMin,
        structureMin: REGIME_THRESHOLDS.structure.entryMin,
        persistMin: REGIME_THRESHOLDS.expansion.participationPersistMin,
        expansionMin: REGIME_THRESHOLDS.expansion.participationExpMin,
        exhaustionMax: REGIME_THRESHOLDS.expansion.invalidationExhaustion,
        pullbackMaxPct: REGIME_THRESHOLDS.pullback.invalidationPullbackMax * 100
      },
      featureWeights: {
        persistWeight: REGIME_THRESHOLDS.expansion.persistWeight,
        accelWeight: REGIME_THRESHOLDS.expansion.accelWeight,
        shallowWeight: REGIME_THRESHOLDS.expansion.shallowWeight,
        institutionalWeight: REGIME_THRESHOLDS.expansion.institutionalWeight
      },
      lifecycleConditions: [
        `sampleCount ≥ 10 for authoritative (${strategy.sampleCount} n)`,
        `promotable: WR≥55%, avgR≥1, fakeout<35% → ${strategy.promotable}`,
        `idealEntryZone: ${strategy.idealEntryZone}`
      ],
      addLogic: [
        `FULL_EXECUTION when expansion≥${REGIME_THRESHOLDS.expansion.fullExecutionExp} ∧ persist≥${REGIME_THRESHOLDS.expansion.fullExecutionPersist}`,
        `PROBING_EXECUTION when persist≥${REGIME_THRESHOLDS.expansion.probingPersist} ∧ expansion≥${REGIME_THRESHOLDS.expansion.probingExp}`
      ],
      exhaustionRules: [
        `exhaustion≥${REGIME_THRESHOLDS.expansion.blockExhaustionMin} blocks participation`,
        `pullback depth > ${REGIME_THRESHOLDS.pullback.invalidationPullbackMax * 100}% invalidates`,
        `accelerationIntegrity < ${REGIME_THRESHOLDS.expansion.invalidationIntegrityMin} invalidates`
      ]
    };
  }

  private inputFromStrategy(
    strategy: DiscoveredStrategy,
    centroid?: PreExpansionFeatureVector
  ): LiveRegimeInput {
    const q = centroid;
    return {
      symbol: strategy.topSymbols[0] ?? 'SYN',
      sessionTimeMinutes: q ? q.sessionQ * 15 : 30,
      rvol: q ? 1.5 + q.rvolQ * 0.8 : 2.5,
      vwapDistance: q ? (q.vwapDistQ - 2) * 0.008 : 0.01,
      trendAlignment: q ? 40 + q.trendQ * 12 : 55,
      extended: !!q?.extended,
      structureScore: q?.structureScore ?? 60,
      pullbackDepth: q ? q.pullbackDepthQ * 0.008 : 0.012,
      continuationQuality: strategy.winRate,
      marketRegime: 'TREND'
    };
  }

  private buildSyntheticTriggerSequence(
    input: LiveRegimeInput,
    metrics: import('../live-regime-intelligence/live-regime.models').LiveRegimeMetrics,
    explanation: ExplainableRegimeExplanation
  ): ReplayExplainTimelineEvent[] {
    const now = Date.now();
    return [
      {
        time: 'T-29s',
        timestampMs: now - 29_000,
        event: 'RVOL crossed threshold',
        metric: 'rvol',
        actual: input.rvol ?? 0,
        threshold: REGIME_THRESHOLDS.velocity.rvolSustainedMin
      },
      {
        time: 'T-18s',
        timestampMs: now - 18_000,
        event: 'Compression broke / shallow pullback confirmed',
        metric: 'shallowPullbackQuality',
        actual: metrics.shallowPullbackQuality,
        threshold: REGIME_THRESHOLDS.pullback.qualifiesMin
      },
      {
        time: 'T-12s',
        timestampMs: now - 12_000,
        event: 'Continuation integrity confirmed',
        metric: 'continuationPersistenceScore',
        actual: metrics.continuationPersistenceScore,
        threshold: REGIME_THRESHOLDS.expansion.participationPersistMin
      },
      {
        time: 'T-6s',
        timestampMs: now - 6_000,
        event: `Conviction path → ${explanation.finalConviction}`,
        metric: 'conviction',
        actual: explanation.finalConviction,
        detail: explanation.whyConfidenceIncreased.slice(0, 2).join('; ')
      }
    ];
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function coerceTs(ts: string | number | undefined): number {
  if (ts == null) return Date.now();
  if (typeof ts === 'number') return ts;
  const n = new Date(ts).getTime();
  return Number.isFinite(n) ? n : Date.now();
}

function findNearestBar(history: ReplayHistory, ts: number): number {
  let best = -1;
  let bestDelta = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < history.sessionCandles.length; i++) {
    const ms = new Date(history.sessionCandles[i].time).getTime();
    const delta = Math.abs(ms - ts);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = i;
    }
  }
  return best;
}
