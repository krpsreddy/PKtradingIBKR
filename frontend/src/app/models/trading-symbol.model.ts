export interface TradingSymbol {
  symbol: string;
  enabled: boolean;
  pinned: boolean;
  groupName?: string | null;
  scanEnabled: boolean;
  preloadOnStartup: boolean;
  subscribeLive: boolean;
  displayOrder: number;
  active: boolean;
  lastViewedAt?: string | null;
  sector?: string | null;
  marketCap?: number | null;
  exchange?: string | null;
  floatShares?: number | null;
  avgDailyVolume?: number | null;
  price?: number | null;
  trend?: 'bullish' | 'bearish' | 'neutral' | string;
  trendIcon?: string;
  relativeVolume?: number | null;
  signalState?: string;
  lifecycleState?: string;
  momentumState?: string;
  readinessState?: string;
  openReadinessState?: string;
  gapPercent?: number | null;
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
}

export interface CreateTradingSymbolRequest {
  symbol: string;
  groupName?: string;
  scanEnabled?: boolean;
  subscribeLive?: boolean;
  preloadOnStartup?: boolean;
  enabled?: boolean;
  pinned?: boolean;
}

export interface UpdateTradingSymbolRequest {
  groupName?: string;
  enabled?: boolean;
  pinned?: boolean;
  scanEnabled?: boolean;
  subscribeLive?: boolean;
  preloadOnStartup?: boolean;
  displayOrder?: number;
}

export const SYMBOL_GROUPS = ['AI', 'Semis', 'Software', 'EV', 'Momentum', 'Watch Closely', 'ETFs', 'Swing'] as const;

export type SymbolGroup = typeof SYMBOL_GROUPS[number] | string;
