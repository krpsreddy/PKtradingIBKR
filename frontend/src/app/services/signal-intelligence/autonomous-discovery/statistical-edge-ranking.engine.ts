import {
  DiscoveredStrategy,
  GovernanceSuppressedPattern,
  StrategyFeatureImportance
} from './autonomous-discovery.models';
import { StrategyCluster } from './unsupervised-strategy-clustering.engine';
import {
  decisionForSignal,
  isAvoidDecision,
  isWaitDecision
} from '../adaptive-calibration/adaptive-calibration.util';
import { mfeR, round2 } from './autonomous-discovery.util';
import { LiveExecutionDecision } from '../live-decision/live-decision.models';

/** Rank discovered edges and surface governance conflicts. */
export class StatisticalEdgeRankingEngine {

  rank(strategies: DiscoveredStrategy[]): DiscoveredStrategy[] {
    return strategies.slice().sort((a, b) => {
      const scoreA = this.edgeScore(a);
      const scoreB = this.edgeScore(b);
      return scoreB - scoreA;
    });
  }

  featureImportance(clusters: StrategyCluster[]): StrategyFeatureImportance[] {
    if (clusters.length < 2) return [];
    const top = clusters.slice(0, Math.min(5, clusters.length));
    const rest = clusters.slice(5);
    const baseline = rest.length ? rest : clusters;

    const dims: { key: keyof StrategyCluster['centroid']; label: string }[] = [
      { key: 'rvolQ', label: 'Relative volume quantile' },
      { key: 'sessionQ', label: 'Session timing quantile' },
      { key: 'vwapDistQ', label: 'VWAP distance quantile' },
      { key: 'trendQ', label: 'Trend alignment quantile' },
      { key: 'volatilityQ', label: 'Volatility quantile' },
      { key: 'volumeAccelQ', label: 'Volume acceleration quantile' },
      { key: 'pullbackDepthQ', label: 'Pullback depth quantile' },
      { key: 'structureScore', label: 'Structure score' }
    ];

    return dims.map(({ key, label }) => {
      const topMean = avg(top.map(c => c.centroid[key] as number));
      const baseMean = avg(baseline.map(c => c.centroid[key] as number));
      return {
        dimension: String(key),
        label,
        separationScore: round2(Math.abs(topMean - baseMean)),
        topClusterMean: round2(topMean),
        baselineMean: round2(baseMean)
      };
    }).sort((a, b) => b.separationScore - a.separationScore).slice(0, 8);
  }

  governanceConflicts(
    clusters: StrategyCluster[],
    sampleCount: number
  ): GovernanceSuppressedPattern[] {
    const out: GovernanceSuppressedPattern[] = [];

    for (const c of clusters) {
      if (c.avgR < 1 || c.sampleCount < 3) continue;
      const suppressed = c.signals.filter(s => {
        const d = decisionForSignal(s, sampleCount).decision;
        return (isWaitDecision(d) || isAvoidDecision(d)) && mfeR(s) >= 1;
      });
      if (!suppressed.length) continue;

      const decisions = new Map<LiveExecutionDecision, number>();
      for (const s of suppressed) {
        const d = decisionForSignal(s, sampleCount).decision;
        decisions.set(d, (decisions.get(d) ?? 0) + 1);
      }

      out.push({
        strategyId: c.clusterId,
        strategyName: c.name,
        sampleCount: c.sampleCount,
        avgMissedR: round2(suppressed.reduce((n, s) => n + mfeR(s), 0) / suppressed.length),
        suppressedPct: round2((suppressed.length / c.sampleCount) * 100),
        topGovernanceDecisions: [...decisions.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([d]) => d),
        examples: suppressed.slice(0, 3).map(s =>
          `${s.symbol} +${mfeR(s).toFixed(1)}R · was ${decisionForSignal(s, sampleCount).decision.replace(/_/g, ' ')}`
        )
      });
    }

    return out.sort((a, b) => b.avgMissedR - a.avgMissedR).slice(0, 10);
  }

  private edgeScore(s: DiscoveredStrategy): number {
    const sampleW = Math.min(s.sampleCount, 50) / 50 * 20;
    const wrW = s.winRate * 0.2;
    const rW = Math.max(0, s.avgR) * 15;
    const contW = s.continuationPct * 0.1;
    const fakeW = Math.max(0, 30 - s.fakeoutPct) * 0.3;
    const confW = s.confidence === 'HIGH' ? 15 : s.confidence === 'MODERATE' ? 10 : s.confidence === 'LOW' ? 5 : 0;
    return sampleW + wrW + rW + contW + fakeW + confW;
  }
}

function avg(vals: number[]): number {
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
