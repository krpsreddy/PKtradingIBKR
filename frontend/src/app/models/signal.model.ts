export interface TradingSignal {
  symbol?: string;
  signalType: string;
  price: number;
  timestamp: string;
  rsi: number | null;
  macd?: number | null;
  vwap?: number | null;
  relativeVolume?: number | null;
  confidenceScore?: number | null;
  confidenceLabel?: string | null;
  signalReason?: string | null;
  lifecycleState?: string | null;
  signalReasons?: string[];
  rankScore?: number | null;
  mtfSummary?: string | null;
  freshness?: string | null;
  freshnessLabel?: string | null;
  extended?: boolean;
  optionsWarnings?: string[];
}
