import { Candle } from '../../models/candle.model';

/** VWAP at historical bar (from precomputed candle field — no future bars). */
export class HistoricalVwapEngine {
  atBar(candles: Candle[], barIndex: number): number {
    const c = candles[barIndex];
    if (!c) return 0;
    return c.vwap ?? c.close;
  }
}
