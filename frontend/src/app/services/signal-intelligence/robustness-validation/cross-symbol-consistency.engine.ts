import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { CrossSymbolStabilityRow } from './robustness-validation.models';
import { avgR, winRate } from './robustness-validation.util';

/** Per-symbol consistency within a strategy cluster. */
export class CrossSymbolConsistencyEngine {
  analyze(strategyName: string, signals: SignalSnapshot[]): CrossSymbolStabilityRow[] {
    const map = new Map<string, SignalSnapshot[]>();
    for (const s of signals) {
      map.set(s.symbol, [...(map.get(s.symbol) ?? []), s]);
    }
    return [...map.entries()]
      .map(([symbol, rows]) => ({
        strategyName,
        symbol,
        count: rows.length,
        winRate: winRate(rows),
        avgR: avgR(rows)
      }))
      .sort((a, b) => b.avgR - a.avgR);
  }

  consistencyScore(rows: CrossSymbolStabilityRow[]): number {
    if (rows.length < 2) return 40;
    const avgRs = rows.filter(r => r.count >= 2).map(r => r.avgR);
    if (avgRs.length < 2) return 45;
    const mean = avgRs.reduce((a, b) => a + b, 0) / avgRs.length;
    const spread = Math.max(...avgRs) - Math.min(...avgRs);
    if (mean <= 0) return 30;
    if (spread / mean < 0.5) return 85;
    if (spread / mean < 1) return 65;
    return 40;
  }
}
