import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { pct } from '../signal-intelligence.math';
import { PreExpansionFeatureVector } from './autonomous-discovery.models';
import { PreExpansionFeatureExtractorEngine } from './pre-expansion-feature-extractor.engine';
import { MinedPatternBucket } from './historical-pattern-miner.engine';
import {
  classifyClusterKind,
  confidenceTier,
  featureKey,
  mfeR,
  round2,
  strategyNameFor
} from './autonomous-discovery.util';

export interface StrategyCluster {
  clusterId: string;
  name: string;
  kind: ReturnType<typeof classifyClusterKind>;
  centroid: PreExpansionFeatureVector;
  buckets: MinedPatternBucket[];
  signals: SignalSnapshot[];
  sampleCount: number;
  winRate: number;
  avgR: number;
  avgDollar: number;
  fakeoutPct: number;
  continuationPct: number;
  confidence: ReturnType<typeof confidenceTier>;
}

/** Unsupervised clustering on numeric feature keys — no predefined strategy categories. */
export class UnsupervisedStrategyClusteringEngine {
  private readonly extractor = new PreExpansionFeatureExtractorEngine();

  cluster(buckets: MinedPatternBucket[], mergeRadius = 1): StrategyCluster[] {
    if (!buckets.length) return [];

    const groups = new Map<string, MinedPatternBucket[]>();
    for (const b of buckets) {
      const coarse = this.coarseKey(b.centroid, mergeRadius);
      groups.set(coarse, [...(groups.get(coarse) ?? []), b]);
    }

    const clusters: StrategyCluster[] = [];
    let idx = 0;
    for (const [, group] of groups) {
      const signals = group.flatMap(g => g.signals);
      const n = signals.length;
      if (n < 2) continue;

      const vectors = group.map(g => g.centroid);
      const centroid = this.extractor.centroid(vectors);
      const wins = signals.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5);
      const cont = signals.filter(s => mfeR(s) >= 1);
      const avgR = round2(signals.reduce((sum, s) => sum + mfeR(s), 0) / n);
      const fakeoutPct = round2(group.reduce((s, g) => s + g.fakeoutPct * g.signals.length, 0) / n);
      const continuationPct = pct(cont.length, n);
      const kind = classifyClusterKind(avgR, continuationPct, fakeoutPct);
      const key = featureKey(centroid);

      clusters.push({
        clusterId: `AD_${++idx}_${key.slice(0, 12)}`,
        name: strategyNameFor(kind, key),
        kind,
        centroid,
        buckets: group,
        signals,
        sampleCount: n,
        winRate: pct(wins.length, n),
        avgR,
        avgDollar: round2(signals.reduce((sum, s) => sum + (s.evaluation?.mfe ?? 0), 0) / n),
        fakeoutPct,
        continuationPct,
        confidence: confidenceTier(n)
      });
    }

    return clusters.sort((a, b) => b.avgR - a.avgR);
  }

  /** Merge nearby quantile bins to form emergent clusters. */
  private coarseKey(v: PreExpansionFeatureVector, radius: number): string {
    const q = (n: number) => Math.floor(n / Math.max(1, radius));
    return [
      q(v.rvolQ), q(v.sessionQ), q(v.vwapDistQ), q(v.trendQ),
      q(v.volatilityQ), q(v.convictionQ), v.extended, v.regimeCode,
      q(v.pullbackDepthQ), q(v.volumeAccelQ)
    ].join('|');
  }
}
