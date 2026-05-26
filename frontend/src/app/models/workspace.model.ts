export interface IntelligenceFields {
  rankScore?: number | null;
  rank?: number | null;
  mtfSummary?: string | null;
  freshness?: string | null;
  freshnessLabel?: string | null;
  extended?: boolean;
  extendedState?: string | null;
  optionsWarnings?: string[];
  estimatedRr?: number | null;
  rrQuality?: string | null;
  tradeQualityGrade?: string | null;
  tradeQualityScore?: number | null;
  deteriorationState?: string | null;
  deteriorationReasons?: string[];
  noEdge?: boolean;
  noEdgeMessage?: string | null;
  whyNotReasons?: string[];
  alertPriority?: string | null;
}

export interface WatchlistItem {
  symbol: string;
  source?: 'DEFAULT' | 'USER' | string;
  active?: boolean;
  pinned?: boolean;
  price: number | null;
  trend: 'bullish' | 'bearish' | 'neutral';
  trendIcon: string;
  relativeVolume?: number | null;
  signalState?: string;
  lifecycleState?: string;
  momentumState?: string;
  confidenceScore?: number | null;
  confidenceLabel?: string | null;
  highRvol?: boolean;
  historicalLoaded?: boolean;
  liveSubscribed?: boolean;
  sparkline?: number[];
  trend5m?: string | null;
  trend15m?: string | null;
  trend1h?: string | null;
  mtfSummary?: string | null;
  mtfAlignmentScore?: number | null;
  extended?: boolean;
  extendedState?: string | null;
  freshness?: string | null;
  freshnessLabel?: string | null;
  rankScore?: number | null;
  regimeAligned?: boolean;
  optionsWarnings?: string[];
  isCustom?: boolean;
  isDefault?: boolean;
}

export interface SymbolSubscribeResponse {
  symbol: string;
  status: string;
  historicalLoaded: boolean;
  liveSubscribed: boolean;
  cached: boolean;
  candleCount: number;
  message: string;
}

export interface SymbolCacheEntry {
  candles: import('./candle.model').Candle[];
  indicators: import('./indicator.model').IndicatorSnapshot;
  signals: import('./signal.model').TradingSignal[];
}

export interface ActiveSignal extends IntelligenceFields {
  symbol: string;
  signalType: string;
  price?: number | null;
  rsi: number | null;
  relativeVolume: number | null;
  timestamp: string;
  confidenceScore?: number | null;
  confidenceLabel?: string | null;
  lifecycleState?: string | null;
  trend?: string | null;
  signalReasons?: string[];
}

export interface HotMomentumItem extends IntelligenceFields {
  symbol: string;
  confidenceScore: number | null;
  confidenceLabel: string | null;
  relativeVolume: number | null;
  trend: string;
  signalType: string;
  lifecycleState: string | null;
  signalReasons?: string[];
  timestamp?: string | null;
}

export interface OpeningMomentumItem extends IntelligenceFields {
  symbol: string;
  gapPercent: number | null;
  relativeVolume: number | null;
  confidenceScore: number | null;
  confidenceLabel: string | null;
  signalType: string;
  lifecycleState: string | null;
  signalReasons?: string[];
}

export interface ReplayEventItem {
  symbol: string;
  timestamp: string;
  signalType: string;
  lifecycleState: string | null;
  score: number | null;
  passedConditions: string[];
  failedConditions: string[];
  price: number | null;
  volume: number | null;
  rvol: number | null;
  vwapState: string | null;
}

export interface MarketTrend {
  spyTrend: string;
  qqqTrend: string;
  marketAligned: boolean;
  regime?: string | null;
  regimeSummary?: string | null;
  choppy?: boolean;
  riskOn?: boolean;
  riskOnScore?: number | null;
  semiBreadth?: string | null;
  aiBreadth?: string | null;
  spyPersistence?: number | null;
  qqqPersistence?: number | null;
}

export type TrendShade = 'bullish' | 'bearish' | 'neutral';

export type LifecycleState = 'NEW' | 'ACTIVE' | 'WEAKENING' | 'INVALIDATED' | 'EXITED';
