import { ExplainableBearishExplanation } from '../bearish/bearish-regime.models';
import { BEARISH_REGIME_FORMULAS, BEARISH_REGIME_THRESHOLDS } from '../bearish/bearish-regime-threshold-engine';
import { DiscoveredStrategy } from '../../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { ExplainableClusterContext } from '../explainable-regime.models';
import {
  ConfidenceContributorLine,
  EngineeringTriggerLine,
  LayeredExplainability
} from './explainability-layer.models';
import {
  dedupeTriggers,
  engineeringLine,
  fromNumericCheck
} from './engineering-trigger.util';
import { RawDiscoveryStatsBuilder } from './raw-discovery-stats.builder';

/** Phase 208 — bearish layered explainability with full engineering gates. */
export class BearishExplainabilityLayerBuilder {
  private readonly rawStats = new RawDiscoveryStatsBuilder();

  build(
    ex: ExplainableBearishExplanation,
    strategy?: DiscoveredStrategy,
    ctx?: ExplainableClusterContext
  ): LayeredExplainability {
    const raw = ex.rawMetrics ?? {};
    return {
      direction: 'BEARISH',
      clusterName: ex.strategySpec?.strategyName ?? ex.regimeLabel,
      regimeLabel: ex.bearishRegimeType,
      finalScore: ex.finalConviction,
      structuralSummary: this.structuralSummary(ex),
      exactTriggers: this.engineeringTriggers(ex, raw),
      structuralInterpretation: this.structuralInterpretation(ex),
      confidenceContributors: this.confidenceLines(ex),
      lifecycleEvolution: ex.lifecyclePath.map(s => ({ phase: s.phase, detail: s.reason })),
      invalidatesIf: [...ex.exhaustionRules, ...ex.whyEntryInvalidated].filter(Boolean),
      formulaDebug: this.formulaDebug(ex),
      rawDiscoveryStats: strategy ? this.rawStats.build(strategy, ctx) : [],
      triggerSequence: ex.triggerSequence.map(e => ({
        time: e.time,
        event: e.event,
        detail: e.detail
      }))
    };
  }

  private structuralSummary(ex: ExplainableBearishExplanation): string {
    const squeeze =
      ex.squeezeRiskLevel === 'CRITICAL' || ex.squeezeRiskLevel === 'HIGH'
        ? ` Elevated squeeze risk (${ex.squeezeRiskLevel}).`
        : '';
    return `Failed reclaim / rejection structure with active downside persistence and ${ex.putEntryGrade.replace(/_/g, ' ').toLowerCase()} profile.${squeeze}`;
  }

  private engineeringTriggers(
    ex: ExplainableBearishExplanation,
    raw: Record<string, number | string | boolean>
  ): EngineeringTriggerLine[] {
    const T = BEARISH_REGIME_THRESHOLDS;
    const reclaim = num(raw['reclaimFailureScore']);
    const reject = num(raw['rejectionPersistence']);
    const accel = num(raw['breakdownAcceleration']);
    const distrib = num(raw['distributionScore']);
    const rvol = num(raw['rvol']);
    const squeeze = num(raw['squeezeRiskScore']);

    const lines = [
      engineeringLine('ReclaimFailureScore', round(reclaim), '>=', T.reclaim.failureMin, reclaim >= T.reclaim.failureMin, 'reclaimFailureScore'),
      engineeringLine('RejectionPersistence', round(reject), '>=', T.rejection.persistenceMin, reject >= T.rejection.persistenceMin, 'rejectionPersistence'),
      engineeringLine('BreakdownAcceleration', round(accel), '>=', T.breakdown.accelerationMin, accel >= T.breakdown.accelerationMin, 'breakdownAcceleration'),
      engineeringLine('DistributionPersistence', round(distrib), '>=', T.distribution.persistMin, distrib >= T.distribution.persistMin, 'distributionPersistence'),
      engineeringLine('DownsideRVOL', round(rvol), '>=', T.breakdown.downsideRvolMin, rvol >= T.breakdown.downsideRvolMin, 'downsideRvol'),
      engineeringLine('SqueezeRisk', round(squeeze), '<=', 65, squeeze <= 65, 'squeezeRisk'),
      engineeringLine('BreakdownProbability', round(ex.breakdownProbability), '>=', 50, ex.breakdownProbability >= 50, 'breakdownProbability'),
      engineeringLine('MarketWeakness', round(num(raw['marketWeakness'])), '>=', T.distribution.marketWeaknessMin, num(raw['marketWeakness']) >= T.distribution.marketWeaknessMin, 'marketWeakness')
    ];

    for (const c of ex.entryConditions) {
      lines.push(fromNumericCheck(c));
    }
    for (const c of ex.invalidationConditions) {
      lines.push(fromNumericCheck(c));
    }
    return dedupeTriggers(lines);
  }

  private structuralInterpretation(ex: ExplainableBearishExplanation): string[] {
    const out: string[] = [];
    if (ex.whyBreakdownLikely.length) {
      out.push(...ex.whyBreakdownLikely.map(s =>
        s.replace(/Breakdown survival/i, 'Downside continuation survival')
          .replace(/Collapse acceleration/i, 'Rejection persistence accelerating')
      ));
    }
    if (ex.squeezeRiskLevel === 'HIGH' || ex.squeezeRiskLevel === 'CRITICAL') {
      out.push('Squeeze risk elevated — breakdown chase requires caution.');
    }
    if (!out.length) {
      out.push('Bearish structure aligns with breakdown continuation engineering gates.');
    }
    return out.slice(0, 5);
  }

  private confidenceLines(ex: ExplainableBearishExplanation): ConfidenceContributorLine[] {
    const main = ex.featureContributions.map(c => ({
      label: c.feature,
      delta: c.delta,
      runningTotal: c.runningTotal
    }));
    const structure = ex.structureBreakdown?.map(c => ({
      label: `structure.${c.feature}`,
      delta: c.delta,
      runningTotal: c.runningTotal
    })) ?? [];
    return [...structure, ...main].filter((c, i, arr) => arr.findIndex(x => x.label === c.label) === i);
  }

  private formulaDebug(ex: ExplainableBearishExplanation) {
    return {
      headline: 'bearish structureScore',
      base: BEARISH_REGIME_THRESHOLDS.structure.entryMin,
      lines: (ex.structureBreakdown ?? []).map(c => ({
        term: c.feature,
        delta: c.delta,
        note: c.reason
      })),
      formulas: { ...ex.formulas, ...BEARISH_REGIME_FORMULAS }
    };
  }
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
