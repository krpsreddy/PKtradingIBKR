export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema9: number | null;
  ema20: number | null;
  ema50: number | null;
  vwap: number | null;
}
