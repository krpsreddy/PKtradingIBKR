import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { isEvaluatedSignal } from '../signal-intelligence.math';
import { ContinuationArchetypeStats } from './continuation-promotion.models';
import {
  confidenceTier,
  isPromotableStats,
  mfeR,
  round2
} from './continuation-promotion.util';
import { ContinuationAcceptanceEngine } from '../entry-sequencing/continuation-acceptance.engine';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { classifyEntryLocation } from '../winner-decomposition/winner-decomposition.util';

/** Compute historical profitability by continuation archetype. */
export class EliteContinuationProfileEngine {
  private readonly continuationEngine = new ContinuationAcceptanceEngine();
  private readonly falseBreakout = new FalseBreakoutAnalyticsEngine();

  analyze(signals: SignalSnapshot[]): ContinuationArchetypeStats[] {
    const map = new Map<string, SignalSnapshot[]>();

    for (const s of signals) {
      if (!isEvaluatedSignal(s)) continue;
      const loc = classifyEntryLocation(s);
      const cont = this.continuationEngine.classify(s);
      const key = `${loc}|${cont}`;
      const bucket = map.get(key) ?? [];
      bucket.push(s);
      map.set(key, bucket);
    }

    return [...map.entries()]
      .map(([key, rows]) => {
        const [entryLocation, continuationLevel] = key.split('|');
        const wins = rows.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5).length;
        const contHits = rows.filter(s => s.evaluation?.hit1R || mfeR(s) >= 1).length;
        const fakeouts = rows.filter(s => this.falseBreakout.isFalseBreakout(s)).length;
        const stats = {
          count: rows.length,
          winRate: round2((wins / rows.length) * 100),
          avgR: round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length),
          continuationPct: round2((contHits / rows.length) * 100),
          fakeoutPct: round2((fakeouts / rows.length) * 100)
        };
        return {
          archetype: `${entryLocation} + ${continuationLevel}`,
          entryLocation,
          continuationLevel,
          ...stats,
          confidence: confidenceTier(rows.length),
          promotable: isPromotableStats(stats)
        };
      })
      .filter(r => r.count >= 3)
      .sort((a, b) => b.avgR - a.avgR);
  }

  findArchetype(stats: ContinuationArchetypeStats[], entryLocation: string, continuationLevel: string): ContinuationArchetypeStats | undefined {
    return stats.find(s =>
      s.entryLocation === entryLocation && s.continuationLevel === continuationLevel
    ) ?? stats.find(s => s.archetype.includes(entryLocation) && s.archetype.includes(continuationLevel));
  }
}
