import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { isEvaluatedSignal } from '../signal-intelligence.math';
import { HealthyContinuationStat } from './continuation-promotion.models';
import { confidenceTier, mfeR, round2 } from './continuation-promotion.util';

/** Stair-step trend persistence + higher-low continuation analytics. */
export class TrendPersistenceConfidenceEngine {

  analyze(signals: SignalSnapshot[]): HealthyContinuationStat[] {
    const patterns = [
      { label: 'Stair-step higher lows', match: (s: SignalSnapshot) => (s.trendAlignment ?? 0) >= 65 && !s.extendedEntry },
      { label: 'EMA/VWAP acceptance', match: (s: SignalSnapshot) => (s.vwapDistance ?? 0) >= 0 && (s.emaAlignment ?? false) },
      { label: 'Slow drift trend persistence', match: (s: SignalSnapshot) => s.marketRegime === 'TREND' && (s.rvol ?? 0) < 3 },
      { label: 'Second-leg compression', match: (s: SignalSnapshot) => (s.sourceSignalType ?? s.signalType ?? '').includes('CONT') }
    ];

    const out: HealthyContinuationStat[] = [];
    for (const { label, match } of patterns) {
      const rows = signals.filter(s => isEvaluatedSignal(s) && match(s));
      if (!rows.length) continue;
      const wins = rows.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5).length;
      out.push({
        label,
        classification: 'TREND_DIGESTION',
        count: rows.length,
        winRate: round2((wins / rows.length) * 100),
        avgR: round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length),
        confidence: confidenceTier(rows.length)
      });
    }
    return out.sort((a, b) => b.avgR - a.avgR);
  }
}
