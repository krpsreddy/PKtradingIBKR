import { DiscoveredStrategy, IdealEntryZoneKind } from './autonomous-discovery.models';
import { PreExpansionFeatureExtractorEngine } from './pre-expansion-feature-extractor.engine';
import { StrategyCluster } from './unsupervised-strategy-clustering.engine';
import {
  confidenceTier,
  describeFeatureVector,
  inferIdealEntryZone,
  round2
} from './autonomous-discovery.util';

/** Convert unsupervised clusters into named discovered strategies. */
export class EntryArchetypeDiscoveryEngine {
  private readonly extractor = new PreExpansionFeatureExtractorEngine();

  discover(
    clusters: StrategyCluster[],
    breakpoints: Record<string, number[]>
  ): DiscoveredStrategy[] {
    return clusters
      .filter(c => c.avgR > 0)
      .map(c => this.toStrategy(c, breakpoints))
      .sort((a, b) => b.avgR - a.avgR)
      .slice(0, 24);
  }

  private toStrategy(c: StrategyCluster, breakpoints: Record<string, number[]>): DiscoveredStrategy {
    const idealEntryZone = inferIdealEntryZone(c.centroid);
    const promotable = c.confidence !== 'INSUFFICIENT'
      && c.winRate >= 55
      && c.avgR >= 1
      && c.fakeoutPct < 35;

    return {
      id: c.clusterId,
      name: c.name,
      kind: c.kind,
      conditions: describeFeatureVector(c.centroid, breakpoints),
      sampleCount: c.sampleCount,
      winRate: c.winRate,
      avgR: c.avgR,
      avgDollar: c.avgDollar,
      fakeoutPct: c.fakeoutPct,
      continuationPct: c.continuationPct,
      confidence: c.confidence,
      featureKey: c.centroid.rvolQ + ':' + c.centroid.sessionQ,
      idealEntryZone,
      promotable,
      topSymbols: [...new Set(c.signals.map(s => s.symbol.toUpperCase()))].slice(0, 8),
      centroid: c.centroid,
      breakpoints
    };
  }

  idealEntryZoneStats(clusters: StrategyCluster[]): {
    zone: IdealEntryZoneKind;
    sampleCount: number;
    avgR: number;
    winRate: number;
  }[] {
    const map = new Map<IdealEntryZoneKind, StrategyCluster[]>();
    for (const c of clusters) {
      const zone = inferIdealEntryZone(c.centroid);
      map.set(zone, [...(map.get(zone) ?? []), c]);
    }
    return [...map.entries()].map(([zone, rows]) => {
      const n = rows.reduce((s, c) => s + c.sampleCount, 0);
      const avgR = rows.reduce((s, c) => s + c.avgR * c.sampleCount, 0) / Math.max(1, n);
      const wr = rows.reduce((s, c) => s + c.winRate * c.sampleCount, 0) / Math.max(1, n);
      return { zone, sampleCount: n, avgR: round2(avgR), winRate: round2(wr) };
    }).sort((a, b) => b.avgR - a.avgR);
  }
}
