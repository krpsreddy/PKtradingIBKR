export interface IndicatorSnapshot {
  ema9: number;
  ema20: number;
  ema50: number;
  rsi: number;
  macd: number;
  signalLine: number;
  vwap: number;
  avgVolume: number;
  relativeVolume: number;
  timestamp?: string;
}
