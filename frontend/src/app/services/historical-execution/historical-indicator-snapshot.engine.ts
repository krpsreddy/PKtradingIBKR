import { Candle } from '../../models/candle.model';
import { IndicatorSnapshot } from '../../models/indicator.model';

/** Indicators at bar index using only candles [0..index] — no future leakage. */
export class HistoricalIndicatorSnapshotEngine {
  build(candles: Candle[], barIndex: number): IndicatorSnapshot | null {
    if (!candles.length || barIndex < 0 || barIndex >= candles.length) return null;
    const c = candles[barIndex];
    const slice = candles.slice(0, barIndex + 1);
    const avgVol = slice.reduce((s, x) => s + (x.volume ?? 0), 0) / Math.max(1, slice.length);
    const rvol = avgVol > 0 ? (c.volume ?? 0) / avgVol : 1;

    return {
      ema9: c.ema9 ?? c.close,
      ema20: c.ema20 ?? c.close,
      ema50: c.ema50 ?? c.close,
      rsi: 50,
      macd: 0,
      signalLine: 0,
      vwap: c.vwap ?? c.close,
      avgVolume: avgVol,
      relativeVolume: Math.round(rvol * 100) / 100,
      timestamp: c.time
    };
  }
}
