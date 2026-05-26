import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import { OptimalPullbackStructure } from './autonomous-discovery.models';
import { PreExpansionFeatureExtractorEngine } from './pre-expansion-feature-extractor.engine';
import { confidenceTier, mfeR, round2 } from './autonomous-discovery.util';

/** Discover optimal pullback depth / compression from statistics — not manual rules. */
export class PullbackPatternDiscoveryEngine {
  private readonly extractor = new PreExpansionFeatureExtractorEngine();

  discover(signals: SignalSnapshot[]): OptimalPullbackStructure[] {
    const evaluated = evaluatedSignals(signals);
    const ctx = this.extractor.buildContext(evaluated);
    const chase = evaluated.filter(s => s.extendedEntry);
    const chaseAvgR = chase.length
      ? chase.reduce((n, s) => n + mfeR(s), 0) / chase.length
      : 0;

    const map = new Map<string, SignalSnapshot[]>();
    for (const s of evaluated) {
      const v = this.extractor.extract(s, ctx);
      const depth = v.pullbackDepthQ <= 1 ? 'shallow' : v.pullbackDepthQ <= 3 ? 'moderate' : 'deep';
      const compression = v.volatilityQ <= 1 ? 'tight' : v.volatilityQ <= 3 ? 'normal' : 'wide';
      const key = `${depth}|${compression}`;
      map.set(key, [...(map.get(key) ?? []), s]);
    }

    return [...map.entries()]
      .map(([key, rows]) => {
        const [pullbackDepthLabel, compressionLabel] = key.split('|');
        const wins = rows.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5);
        const avgR = round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length);
        return {
          id: `PB_${key.replace(/\|/g, '_')}`,
          pullbackDepthLabel,
          compressionLabel,
          sampleCount: rows.length,
          winRate: pct(wins.length, rows.length),
          avgR,
          vsChaseDeltaR: round2(avgR - chaseAvgR),
          confidence: confidenceTier(rows.length)
        };
      })
      .filter(r => r.sampleCount >= 2)
      .sort((a, b) => b.avgR - a.avgR)
      .slice(0, 10);
  }
}
