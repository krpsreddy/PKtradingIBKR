import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { RegimeBreakdownRow } from './robustness-validation.models';
import { avgR, breadthBucket, winRate } from './robustness-validation.util';

/** Regime + breadth breakdown per strategy. */
export class RegimeValidationEngine {
  analyze(strategyName: string, signals: SignalSnapshot[]): {
    rows: RegimeBreakdownRow[];
    consistency: number;
  } {
    const regimeMap = new Map<string, SignalSnapshot[]>();
    const breadthMap = new Map<string, SignalSnapshot[]>();

    for (const s of signals) {
      const r = s.marketRegime ?? 'CHOP';
      regimeMap.set(r, [...(regimeMap.get(r) ?? []), s]);
      const b = breadthBucket(s.trendAlignment);
      breadthMap.set(b, [...(breadthMap.get(b) ?? []), s]);
    }

    const rows: RegimeBreakdownRow[] = [];
    for (const [regime, bucket] of regimeMap) {
      rows.push({
        strategyName,
        regime,
        count: bucket.length,
        winRate: winRate(bucket),
        avgR: avgR(bucket)
      });
    }
    for (const [regime, bucket] of breadthMap) {
      rows.push({
        strategyName,
        regime: `BREADTH_${regime}`,
        count: bucket.length,
        winRate: winRate(bucket),
        avgR: avgR(bucket)
      });
    }

    const avgRs = rows.filter(r => r.count >= 2).map(r => r.avgR);
    if (avgRs.length < 2) return { rows, consistency: 50 };
    const mean = avgRs.reduce((a, b) => a + b, 0) / avgRs.length;
    const variance = avgRs.reduce((n, v) => n + (v - mean) ** 2, 0) / avgRs.length;
    const consistency = Math.max(0, Math.min(100, Math.round((100 - Math.sqrt(variance) * 40) * 100) / 100));
    return { rows, consistency };
  }
}
