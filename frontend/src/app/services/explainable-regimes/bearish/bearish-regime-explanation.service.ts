import { Injectable } from '@angular/core';
import {
  DiscoveredStrategy,
  PreExpansionFeatureVector
} from '../../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { ExplainableClusterContext } from '../explainable-regime.models';
import { ThresholdDecompositionEngine } from '../threshold-decomposition.engine';
import { bearishClusterDisplayName } from './bearish-cluster-classifier';
import { BearishExecutionReasoningEngine } from './bearish-execution-reasoning.engine';
import {
  BearishStrategyExplainableSpec,
  ExplainableBearishExplanation
} from './bearish-regime.models';
import { BEARISH_REGIME_FORMULAS, BEARISH_REGIME_THRESHOLDS } from './bearish-regime-threshold-engine';
import {
  HistoricalBulkDiscoveryApi,
  HistoricalBulkDiscoveryReport,
  RegimeFamilyCluster
} from '../../discovery/historical-bulk-discovery.api';

/** Phase 207 — explainable bearish regime intelligence. */
@Injectable({ providedIn: 'root' })
export class BearishRegimeExplanationService {
  private readonly reasoning = new BearishExecutionReasoningEngine();
  private readonly decomposition = new ThresholdDecompositionEngine();
  private debugMode = false;
  private cachedBearishReport: HistoricalBulkDiscoveryReport | null = null;

  constructor(private historicalApi: HistoricalBulkDiscoveryApi) {}

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  explainStrategy(
    strategy: DiscoveredStrategy,
    ctx?: ExplainableClusterContext,
    displayIndex = 0
  ): ExplainableBearishExplanation {
    const input = this.reasoning.inputFromStrategy(strategy);
    const regimeType = this.reasoning.inferRegimeType(strategy, input);
    const metrics = this.reasoning.metricsFromStrategy(strategy, input);
    const explanation = this.reasoning.build(input, metrics, regimeType, strategy, this.debugMode);
    explanation.strategySpec = this.buildStrategySpec(strategy, regimeType, displayIndex);
    explanation.triggerSequence = this.buildBearishTimeline(input, metrics, explanation);
    return explanation;
  }

  numericConditionsForStrategy(
    strategy: DiscoveredStrategy,
    ctx?: ExplainableClusterContext
  ): { dimension: string; label: string; value: string }[] {
    const base = this.decomposition.decomposeClusterStrategy(strategy, ctx);
    const input = this.reasoning.inputFromStrategy(strategy);
    return [
      ...base,
      { dimension: 'reclaim', label: 'Reclaim failure', value: `${input.reclaimFailureScore}` },
      { dimension: 'reject', label: 'Rejection persist', value: `${input.rejectionPersistence}%` },
      { dimension: 'accel', label: 'Breakdown accel', value: `${input.breakdownAcceleration}` },
      { dimension: 'squeeze', label: 'Squeeze risk', value: `${this.reasoning.metricsFromStrategy(strategy, input).squeezeRiskLevel}` }
    ];
  }

  /** Bridge bearish historical discovery families when client mining has few bearish clusters. */
  async strategiesFromBearishDiscovery(): Promise<DiscoveredStrategy[]> {
    try {
      if (!this.cachedBearishReport) {
        this.cachedBearishReport = await this.historicalApi.load(60, false, 'bearish');
      }
      const families = this.cachedBearishReport.regimeFamilies ?? [];
      return families.slice(0, 12).map((f, i) => this.familyToStrategy(f, i));
    } catch {
      return [];
    }
  }

  clearDiscoveryCache(): void {
    this.cachedBearishReport = null;
  }

  private familyToStrategy(f: RegimeFamilyCluster, index: number): DiscoveredStrategy {
    const id = `bearish-family-${f.family}-${index}`;
    return {
      id,
      name: `${f.family}_CLUSTER`,
      kind: 'CONTINUATION_PROFILE',
      conditions: [
        { dimension: 'family', label: 'Bearish family', value: f.family },
        { dimension: 'n', label: 'Samples', value: String(f.sampleCount) }
      ],
      sampleCount: f.sampleCount,
      winRate: f.winRate,
      avgR: f.avgMfeR,
      avgDollar: 0,
      fakeoutPct: Math.max(20, 100 - f.continuationPct),
      continuationPct: f.continuationPct,
      confidence: f.discoveryConfidenceScore >= 65 ? 'HIGH' : 'MODERATE',
      featureKey: f.family,
      idealEntryZone: 'DIRECT_BREAKOUT',
      promotable: f.winRate >= 52,
      topSymbols: f.memberRegimes?.slice(0, 3) ?? [],
      centroid: {
        rvolQ: 2,
        sessionQ: 2,
        vwapDistQ: 0,
        trendQ: 1,
        volatilityQ: 3,
        convictionQ: 2,
        extended: 0,
        captureStage: 1,
        regimeCode: 4,
        emaAligned: 0,
        pullbackDepthQ: 2,
        volumeAccelQ: 3,
        structureScore: 48
      }
    };
  }

  private buildStrategySpec(
    strategy: DiscoveredStrategy,
    regimeType: import('./bearish-regime.models').BearishRegimeType,
    displayIndex: number
  ): BearishStrategyExplainableSpec {
    const T = BEARISH_REGIME_THRESHOLDS;
    return {
      strategyId: strategy.id,
      strategyName: bearishClusterDisplayName(strategy, displayIndex),
      bearishRegimeType: regimeType,
      entryFormulas: { ...BEARISH_REGIME_FORMULAS },
      thresholdRefs: {
        reclaimFailureMin: T.reclaim.failureMin,
        rejectionPersistMin: T.rejection.persistenceMin,
        breakdownAccelMin: T.breakdown.accelerationMin,
        squeezeModerate: T.squeeze.moderateMax
      },
      featureWeights: {
        rejectionWeight: T.structure.rejectionWeight,
        weakReclaimWeight: T.structure.weakReclaimWeight,
        squeezePenalty: T.structure.squeezePenalty
      },
      lifecycleConditions: [
        'FAILED_RECLAIM → BREAKDOWN_CONFIRMATION → DISTRIBUTION_ACCELERATION → PANIC_EXPANSION → EXHAUSTION_BOUNCE',
        `PUT grade derived from squeeze + follow-through (n=${strategy.sampleCount})`
      ],
      addLogic: [
        `IDEAL_BREAKDOWN when rejection≥${T.rejection.persistenceMin} and squeeze < ${T.squeeze.moderateMax}`,
        'Avoid PANIC_CHASE when acceleration high but follow-through weak'
      ],
      exhaustionRules: [
        'Strong reclaim above VWAP invalidates',
        `Squeeze ≥ ${T.squeeze.highMax} → CRITICAL — no breakdown chase`,
        'Exhaustion bounce ends panic expansion leg'
      ],
      squeezeContributors: [
        'oversold / exhaustion flush',
        'weak bounce integrity',
        'breadth reversal risk',
        'volatility compression before squeeze'
      ]
    };
  }

  private buildBearishTimeline(
    input: import('./bearish-regime.models').BearishRegimeInput,
    metrics: import('./bearish-regime.models').BearishRegimeMetrics,
    explanation: ExplainableBearishExplanation
  ): import('../explainable-regime.models').ReplayExplainTimelineEvent[] {
    const now = Date.now();
    return [
      {
        time: 'T-28s',
        timestampMs: now - 28_000,
        event: 'Failed reclaim below VWAP',
        metric: 'reclaimFailure',
        actual: input.reclaimFailureScore,
        threshold: BEARISH_REGIME_THRESHOLDS.reclaim.failureMin
      },
      {
        time: 'T-20s',
        timestampMs: now - 20_000,
        event: 'Rejection persistence confirmed',
        metric: 'rejectionPersistence',
        actual: input.rejectionPersistence,
        threshold: BEARISH_REGIME_THRESHOLDS.rejection.persistenceMin
      },
      {
        time: 'T-14s',
        timestampMs: now - 14_000,
        event: 'Downside acceleration expansion',
        metric: 'breakdownAcceleration',
        actual: input.breakdownAcceleration,
        threshold: BEARISH_REGIME_THRESHOLDS.breakdown.accelerationMin
      },
      {
        time: 'T-8s',
        timestampMs: now - 8_000,
        event: `Squeeze risk ${metrics.squeezeRiskLevel}`,
        metric: 'squeezeRisk',
        actual: metrics.squeezeRiskScore,
        detail: explanation.whySqueezeDangerous.join('; ')
      },
      {
        time: 'T-0',
        timestampMs: now,
        event: `${explanation.bearishRegimeType.replace(/_/g, ' ')} classified`,
        metric: 'regime',
        actual: explanation.finalConviction,
        detail: `PUT grade ${explanation.putEntryGrade}`
      }
    ];
  }
}
