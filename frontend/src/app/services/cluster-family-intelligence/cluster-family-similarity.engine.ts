import { PreExpansionFeatureVector } from '../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { DiscoveredStrategy } from '../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { AutonomousExecutionInput } from '../signal-intelligence/autonomous-execution/autonomous-execution.models';

/** Centroid + live-context similarity for cluster-family matching. */
export class ClusterFamilySimilarityEngine {
  vectorFromStrategy(s: DiscoveredStrategy): number[] {
    const c = s.centroid;
    if (!c) return [s.avgR / 10, s.winRate / 100, s.sampleCount / 50];
    return [
      c.rvolQ / 4,
      c.sessionQ / 4,
      c.vwapDistQ / 4,
      c.trendQ / 4,
      c.volatilityQ / 4,
      c.convictionQ / 4,
      c.extended,
      c.emaAligned,
      c.pullbackDepthQ / 4,
      c.volumeAccelQ / 4,
      c.structureScore / 100
    ];
  }

  vectorFromLive(input: AutonomousExecutionInput): number[] {
    const rvol = input.rvol ?? 1;
    const session = (input.sessionTimeMinutes ?? 30) / 90;
    const vwap = Math.min(4, Math.abs(input.vwapDistance ?? 0) * 200);
    const trend = (input.trendAlignment ?? 50) / 100;
    return [
      Math.min(4, rvol / 1.5),
      Math.min(4, session * 4),
      vwap,
      trend * 4,
      0.5,
      trend * 4,
      input.extended ? 1 : 0,
      0,
      vwap,
      Math.min(4, rvol / 2),
      trend
    ];
  }

  similarity(a: number[], b: number[]): number {
    if (!a.length || !b.length) return 0;
    const n = Math.min(a.length, b.length);
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < n; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return Math.min(1, dot / (Math.sqrt(na) * Math.sqrt(nb)));
  }

  matchStrategy(input: AutonomousExecutionInput, strategy: DiscoveredStrategy): number {
    const live = this.vectorFromLive(input);
    const cluster = this.vectorFromStrategy(strategy);
    const structural = (strategy.centroid?.structureScore ?? 50) / 100;
    const base = this.similarity(live, cluster);
    return Math.min(1, base * 0.85 + structural * 0.15);
  }

  centroidDistance(a: PreExpansionFeatureVector, b: PreExpansionFeatureVector): number {
    const va = this.vectorFromCentroid(a);
    const vb = this.vectorFromCentroid(b);
    return 1 - this.similarity(va, vb);
  }

  private vectorFromCentroid(c: PreExpansionFeatureVector): number[] {
    return [
      c.rvolQ / 4, c.sessionQ / 4, c.vwapDistQ / 4, c.trendQ / 4,
      c.structureScore / 100, c.volumeAccelQ / 4, c.extended
    ];
  }
}
