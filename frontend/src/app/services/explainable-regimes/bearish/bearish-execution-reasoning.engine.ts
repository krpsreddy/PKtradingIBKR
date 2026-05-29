import { DiscoveredStrategy } from '../../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { LiveRegimeClassification } from '../../live-regime-intelligence/live-regime.models';
import { FeatureContribution } from '../explainable-regime.models';
import {
  BearishLifecycleStep,
  BearishPutEntryGrade,
  BearishRegimeInput,
  BearishRegimeMetrics,
  BearishRegimeType,
  ExplainableBearishExplanation,
  SqueezeRiskLevel
} from './bearish-regime.models';
import { BEARISH_REGIME_FORMULAS, BEARISH_REGIME_THRESHOLDS } from './bearish-regime-threshold-engine';

/** Phase 207 — assembles bearish explainable output. */
export class BearishExecutionReasoningEngine {
  build(
    input: BearishRegimeInput,
    metrics: BearishRegimeMetrics,
    regimeType: BearishRegimeType,
    strategy?: DiscoveredStrategy,
    debugMode = false
  ): ExplainableBearishExplanation {
    const T = BEARISH_REGIME_THRESHOLDS;
    const triggered: string[] = [];
    const invalidates: string[] = [];

    if (input.reclaimFailureScore >= T.reclaim.failureMin) {
      triggered.push(`Failed reclaim below VWAP (score ${input.reclaimFailureScore} ≥ ${T.reclaim.failureMin})`);
    }
    if (input.rejectionPersistence >= T.rejection.persistenceMin) {
      triggered.push(`Rejection persistence active (${input.rejectionPersistence}%)`);
    }
    if (input.breakdownAcceleration >= T.breakdown.accelerationMin) {
      triggered.push(`Downside acceleration confirmed (${input.breakdownAcceleration})`);
    }
    if (input.distributionScore >= T.distribution.persistMin) {
      triggered.push(`Distribution persistence (${input.distributionScore})`);
    }
    if (input.marketWeakness >= T.distribution.marketWeaknessMin) {
      triggered.push(`Broad market weakness alignment (${input.marketWeakness})`);
    }
    if (input.sectorWeakness >= 40) {
      triggered.push(`Sector deterioration (${input.sectorWeakness})`);
    }
    if (input.lowerHighStructure) {
      triggered.push('Lower-high structure confirmed');
    }
    if ((input.rvol ?? 0) >= T.breakdown.downsideRvolMin) {
      triggered.push(`Bearish RVOL expansion (${input.rvol?.toFixed(2)})`);
    }

    if (input.reclaimFailureScore < T.reclaim.strongReclaimInvalidates) {
      invalidates.push(`Strong reclaim above VWAP if failure score drops below ${T.reclaim.strongReclaimInvalidates}`);
    } else {
      invalidates.push('Strong reclaim above VWAP invalidates breakdown');
    }
    if (metrics.squeezeRiskScore >= T.squeeze.moderateMax) {
      invalidates.push(`Squeeze risk ${metrics.squeezeRiskLevel} — avoid chase`);
    }
    if (metrics.rejectionPersistenceScore < 45) {
      invalidates.push('Failed downside persistence (< 45)');
    }
    if (input.exhaustionFlush && metrics.squeezeRiskScore >= T.squeeze.highMax) {
      invalidates.push('Exhaustion bounce detected — flush may be ending');
    }
    if ((input.rvol ?? 0) < 1.0) {
      invalidates.push('Volume deterioration on breakdown (< 1.0 RVOL)');
    }

    const structureBreakdown = this.structureContributions(input, metrics);
    const contrib = this.confidenceContributions(input, metrics, structureBreakdown);
    const base = 32;
    const final = Math.round(Math.min(98, Math.max(0, contrib[contrib.length - 1]?.runningTotal ?? base)));

    const lifecycle = this.lifecyclePath(regimeType, input, metrics);
    const putGrade = this.putEntryGrade(metrics, input);

    const whySqueeze: string[] = [];
    if (metrics.squeezeRiskLevel === 'CRITICAL' || metrics.squeezeRiskLevel === 'HIGH') {
      whySqueeze.push(`Squeeze risk ${metrics.squeezeRiskLevel} (${metrics.squeezeRiskScore}) — oversold / bounce velocity elevated`);
    }

    return {
      advisoryOnly: true,
      direction: 'BEARISH',
      regimeType: 'INSTITUTIONAL_PERSISTENCE',
      bearishRegimeType: regimeType,
      regimeLabel: regimeType.replace(/_/g, ' '),
      classification: (metrics.breakdownProbability >= 55
        ? 'PERSISTENT_TREND'
        : 'CHOP_UNSTABLE') as LiveRegimeClassification,
      symbol: input.symbol,
      squeezeRiskLevel: metrics.squeezeRiskLevel,
      squeezeRiskScore: metrics.squeezeRiskScore,
      putEntryGrade: putGrade,
      entryConditions: this.entryChecks(input, metrics),
      invalidationConditions: this.invalidationChecks(input, metrics),
      triggerSequence: [],
      featureContributions: contrib,
      structureBreakdown,
      lifecyclePath: lifecycle,
      convictionBase: base,
      finalConviction: final,
      whyEntryValid: triggered,
      whyEntryInvalidated: invalidates,
      whyBreakdownLikely: [
        `Breakdown survival ${metrics.breakdownSurvivalScore}%`,
        `Collapse acceleration ${metrics.collapseAccelerationScore}`,
        `Downside continuation probability ${metrics.breakdownProbability}%`
      ],
      whySqueezeDangerous: whySqueeze,
      breakdownProbability: metrics.breakdownProbability,
      whyConfidenceIncreased: contrib.filter(c => c.delta > 0).map(c => `${c.feature}: +${c.delta}`),
      whyConfidenceDropped: contrib.filter(c => c.delta < 0).map(c => `${c.feature}: ${c.delta} (squeeze/market)`),
      whyExtensionHealthy: [],
      whyExhaustionDetected: input.exhaustionFlush
        ? ['Exhaustion flush — monitor bounce risk']
        : [],
      persistenceLogic: [
        `Rejection persistence ${metrics.rejectionPersistenceScore}% (must stay ≥ ${T.rejection.persistenceMin})`,
        `Breakdown survival ${metrics.breakdownSurvivalScore}%`,
        `Panic continuation while acceleration ≥ ${T.breakdown.accelerationMin}`
      ],
      exhaustionRules: invalidates,
      formulas: { ...BEARISH_REGIME_FORMULAS },
      rawMetrics: {
        ...input,
        ...metrics,
        strategySample: strategy?.sampleCount ?? 0
      },
      debugMode
    };
  }

  inferRegimeType(strategy: DiscoveredStrategy, input: BearishRegimeInput): BearishRegimeType {
    const n = strategy.name.toUpperCase();
    if (n.includes('RECLAIM')) return 'FAILED_RECLAIM';
    if (n.includes('VWAP') || n.includes('REJECT')) return 'VWAP_REJECTION';
    if (n.includes('DISTRIB')) return 'DISTRIBUTION_BREAKDOWN';
    if (n.includes('PANIC')) return 'PANIC_EXPANSION';
    if (n.includes('EXHAUST')) return 'EXHAUSTION_REVERSAL';
    if (n.includes('WEAK')) return 'WEAK_RECLAIM_FAILURE';
    if (input.breakdownAcceleration >= 60) return 'ACCELERATED_SELLING';
    return 'BREAKDOWN_CONTINUATION';
  }

  metricsFromStrategy(strategy: DiscoveredStrategy, input: BearishRegimeInput): BearishRegimeMetrics {
    const survival = Math.round(
      input.rejectionPersistence * 0.35 +
        input.breakdownAcceleration * 0.35 +
        input.distributionScore * 0.2 +
        input.marketWeakness * 0.1
    );
    let squeeze = 15;
    if (input.exhaustionFlush) squeeze += 25;
    if (input.weakBounceScore >= 50) squeeze += 20;
    if ((input.rvol ?? 0) < 1.2) squeeze += 15;
    if (input.marketWeakness < 40) squeeze += 10;
    squeeze = Math.min(100, squeeze);

    const level: SqueezeRiskLevel =
      squeeze <= BEARISH_REGIME_THRESHOLDS.squeeze.lowMax
        ? 'LOW'
        : squeeze <= BEARISH_REGIME_THRESHOLDS.squeeze.moderateMax
          ? 'MODERATE'
          : squeeze <= BEARISH_REGIME_THRESHOLDS.squeeze.highMax
            ? 'HIGH'
            : 'CRITICAL';

    const structure = Math.round(
      BEARISH_REGIME_THRESHOLDS.structure.entryMin +
        (input.rejectionPersistence / 100) * BEARISH_REGIME_THRESHOLDS.structure.rejectionWeight +
        (input.reclaimFailureScore / 100) * BEARISH_REGIME_THRESHOLDS.structure.weakReclaimWeight +
        ((input.rvol ?? 1) * 4) +
        (input.marketWeakness / 100) * BEARISH_REGIME_THRESHOLDS.structure.marketWeaknessWeight -
        (squeeze / 100) * BEARISH_REGIME_THRESHOLDS.structure.squeezePenalty
    );

    const breakdownProb = Math.max(0, Math.min(100, survival - Math.round(squeeze * 0.35)));

    return {
      breakdownSurvivalScore: survival,
      rejectionPersistenceScore: input.rejectionPersistence,
      collapseAccelerationScore: input.breakdownAcceleration,
      downsideRvolScore: Math.round((input.rvol ?? 1) * 40),
      squeezeRiskScore: squeeze,
      squeezeRiskLevel: level,
      putFollowThroughScore: Math.round(breakdownProb * 0.6 + input.rejectionPersistence * 0.25 - squeeze * 0.15),
      structureScore: structure,
      breakdownProbability: breakdownProb
    };
  }

  inputFromStrategy(strategy: DiscoveredStrategy): BearishRegimeInput {
    const c = strategy.centroid;
    const weak = strategy.fakeoutPct > 30 ? 55 + strategy.fakeoutPct * 0.5 : 30;
    return {
      symbol: strategy.topSymbols[0] ?? 'SYN',
      sessionTimeMinutes: c ? c.sessionQ * 18 : 45,
      rvol: c ? 1.1 + c.rvolQ * 0.5 : 1.8,
      vwapDistance: c ? (c.vwapDistQ - 2) * -0.01 : -0.006,
      rejectionPersistence: Math.min(95, strategy.continuationPct > 50 ? 100 - strategy.continuationPct + 40 : 55),
      reclaimFailureScore: Math.min(92, 45 + strategy.fakeoutPct),
      breakdownAcceleration: Math.min(90, 40 + (strategy.avgR < 0 ? 25 : 0) + (c?.volumeAccelQ ?? 2) * 8),
      weakBounceScore: weak,
      distributionScore: Math.min(88, 35 + (c?.structureScore ?? 50) * 0.4),
      marketWeakness: c && c.trendQ <= 1 ? 58 : 42,
      sectorWeakness: strategy.winRate < 50 ? 52 : 38,
      lowerHighStructure: strategy.fakeoutPct > 28,
      exhaustionFlush: strategy.kind === 'EXPANSION_CLUSTER' && strategy.continuationPct < 40
    };
  }

  private structureContributions(
    input: BearishRegimeInput,
    metrics: BearishRegimeMetrics
  ): FeatureContribution[] {
    const T = BEARISH_REGIME_THRESHOLDS.structure;
    let total = T.entryMin;
    const rows: FeatureContribution[] = [];
    const add = (feature: string, delta: number, formula: string, reason: string) => {
      total += delta;
      rows.push({ feature, formula, delta, runningTotal: Math.round(total), reason });
    };
    add('rejection', T.rejectionWeight, 'rejection×weight', `rejection persistence ${input.rejectionPersistence}%`);
    add('weak reclaim', T.weakReclaimWeight, 'reclaimFailure×weight', `reclaim failure ${input.reclaimFailureScore}`);
    add('downside RVOL', T.rvolWeight, 'rvol×4', `RVOL ${input.rvol?.toFixed(2)}`);
    add('market weakness', T.marketWeaknessWeight, 'market×weight', `market ${input.marketWeakness}`);
    add('squeeze risk', -T.squeezePenalty, '−squeezePenalty', `squeeze ${metrics.squeezeRiskScore}`);
    return rows;
  }

  private confidenceContributions(
    input: BearishRegimeInput,
    metrics: BearishRegimeMetrics,
    structure: FeatureContribution[]
  ): FeatureContribution[] {
    const base = 32;
    const rows: FeatureContribution[] = [
      { feature: 'base', formula: 'base', delta: base, runningTotal: base, reason: 'Bearish base conviction' }
    ];
    let t = base;
    const bump = (f: string, d: number, r: string) => {
      t += d;
      rows.push({ feature: f, formula: f, delta: d, runningTotal: Math.round(t), reason: r });
    };
    bump('reclaim failure', Math.round(input.reclaimFailureScore * 0.12), 'reclaim failure contributor');
    bump('downside acceleration', Math.round(input.breakdownAcceleration * 0.1), 'acceleration');
    bump('distribution', Math.round(input.distributionScore * 0.08), 'distribution persist');
    if (metrics.squeezeRiskScore > 55) {
      bump('squeeze penalty', -Math.round(metrics.squeezeRiskScore * 0.15), 'squeeze reduces PUT quality');
    }
    return rows;
  }

  private lifecyclePath(
    type: BearishRegimeType,
    input: BearishRegimeInput,
    metrics: BearishRegimeMetrics
  ): BearishLifecycleStep[] {
    const steps: BearishLifecycleStep[] = [
      { phase: type, reason: 'Initial bearish structure classified from cluster centroid' }
    ];
    if (type === 'FAILED_RECLAIM' || type === 'WEAK_RECLAIM_FAILURE') {
      steps.push({ phase: 'BREAKDOWN_CONFIRMATION', reason: 'Reclaim failure → breakdown confirmation' });
    }
    if (input.distributionScore >= 48) {
      steps.push({ phase: 'DISTRIBUTION_ACCELERATION', reason: 'Distribution persistence accelerating' });
    }
    if (metrics.collapseAccelerationScore >= 55) {
      steps.push({ phase: 'PANIC_EXPANSION', reason: 'Collapse acceleration expansion' });
    }
    if (metrics.squeezeRiskScore >= 60) {
      steps.push({ phase: 'EXHAUSTION_BOUNCE', reason: 'Elevated squeeze — exhaustion bounce risk' });
    }
    return steps;
  }

  private putEntryGrade(metrics: BearishRegimeMetrics, input: BearishRegimeInput): BearishPutEntryGrade {
    if (metrics.squeezeRiskScore >= BEARISH_REGIME_THRESHOLDS.squeeze.highMax) return 'SQUEEZE_RISK';
    if (input.exhaustionFlush && input.sessionTimeMinutes > 330) return 'LATE_FLUSH';
    if (metrics.collapseAccelerationScore >= 70 && metrics.putFollowThroughScore < 45) return 'PANIC_CHASE';
    if (input.reclaimFailureScore >= 65) return 'FAILED_RECLAIM';
    if (input.rejectionPersistence >= 55 && metrics.putFollowThroughScore >= 55) return 'IDEAL_BREAKDOWN';
    if (input.rejectionPersistence < 45) return 'WEAK_REJECTION';
    return 'IDEAL_BREAKDOWN';
  }

  private entryChecks(input: BearishRegimeInput, metrics: BearishRegimeMetrics) {
    const T = BEARISH_REGIME_THRESHOLDS;
    return [
      {
        feature: 'reclaimFailureScore',
        formula: BEARISH_REGIME_FORMULAS['structureScore'],
        actual: input.reclaimFailureScore,
        threshold: T.reclaim.failureMin,
        operator: '>=' as const,
        passed: input.reclaimFailureScore >= T.reclaim.failureMin
      },
      {
        feature: 'rejectionPersistence',
        formula: BEARISH_REGIME_FORMULAS['breakdownSurvival'],
        actual: input.rejectionPersistence,
        threshold: T.rejection.persistenceMin,
        operator: '>=' as const,
        passed: input.rejectionPersistence >= T.rejection.persistenceMin
      }
    ];
  }

  private invalidationChecks(input: BearishRegimeInput, metrics: BearishRegimeMetrics) {
    return [
      {
        feature: 'squeezeRisk',
        formula: BEARISH_REGIME_FORMULAS['squeezeRiskScore'],
        actual: metrics.squeezeRiskScore,
        threshold: BEARISH_REGIME_THRESHOLDS.squeeze.moderateMax,
        operator: '<' as const,
        passed: metrics.squeezeRiskScore < BEARISH_REGIME_THRESHOLDS.squeeze.moderateMax
      }
    ];
  }
}
