import { Candle } from '../models/candle.model';

export type ChartTimeframe = 'TODAY' | 'MULTI_DAY' | 'REPLAY';

const ET = 'America/New_York';

export function sessionDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso));
}

export function filterCandlesByTimeframe(candles: Candle[], timeframe: ChartTimeframe): Candle[] {
  if (!candles.length || timeframe === 'MULTI_DAY') return candles;
  if (timeframe === 'REPLAY') return candles;

  const lastDay = sessionDayKey(candles[candles.length - 1].time);
  const todayOnly = candles.filter(c => sessionDayKey(c.time) === lastDay);
  return todayOnly.length ? todayOnly : candles;
}

export function prevSessionClose(candles: Candle[]): number | null {
  if (candles.length < 2) return null;
  const lastDay = sessionDayKey(candles[candles.length - 1].time);
  for (let i = candles.length - 2; i >= 0; i--) {
    if (sessionDayKey(candles[i].time) !== lastDay) return candles[i].close;
  }
  return null;
}
