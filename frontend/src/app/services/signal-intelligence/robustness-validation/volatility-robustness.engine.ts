import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { avgR, volatilityBucket, winRate } from './robustness-validation.util';
import { pct } from '../signal-intelligence.math';

/** High vs low volatility regime stability. */
export class VolatilityRobustnessEngine {
  score(signals: SignalSnapshot[]): number {
    const buckets = new Map<string, SignalSnapshot[]>();
    for (const s of signals) {
      const b = volatilityBucket(s.volatility);
      buckets.set(b, [...(buckets.get(b) ?? []), s]);
    }
    const stats = [...buckets.entries()].filter(([, rows]) => rows.length >= 2)
      .map(([, rows]) => ({ avgR: avgR(rows), wr: winRate(rows) }));
    if (stats.length < 2) return 55;
    const avgRs = stats.map(s => s.avgR);
    const spread = Math.max(...avgRs) - Math.min(...avgRs);
    if (spread < 0.5) return 85;
    if (spread < 1) return 70;
    if (spread < 1.5) return 55;
    return 35;
  }

  highVolOnly(signals: SignalSnapshot[]): boolean {
    const high = signals.filter(s => volatilityBucket(s.volatility) === 'HIGH');
    return high.length / Math.max(1, signals.length) > 0.7;
  }
}
