import { Candle } from '../../models/candle.model';

/** RVOL at bar using session-to-date average volume only. */
export class HistoricalRvolEngine {
  atBar(candles: Candle[], barIndex: number): number {
    if (!candles.length || barIndex < 0) return 1;
    const slice = candles.slice(0, barIndex + 1);
    const avg = slice.reduce((s, c) => s + (c.volume ?? 0), 0) / Math.max(1, slice.length);
    const cur = candles[barIndex]?.volume ?? 0;
    return avg > 0 ? Math.round((cur / avg) * 100) / 100 : 1;
  }
}
