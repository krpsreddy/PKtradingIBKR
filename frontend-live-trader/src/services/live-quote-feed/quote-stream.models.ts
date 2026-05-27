export type TrendDirection = 'up' | 'down' | 'flat';

export interface ApiQuote {
  price: number;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  timestamp: number;
  stale: boolean;
}

export type QuoteBatch = Record<string, ApiQuote>;

export interface QuoteRow {
  price: number;
  change: number;
  changePercent: number;
  volume: number | null;
  timestamp: number;
  stale: boolean;
  trend: TrendDirection;
}

export interface QuoteFeedStatus {
  connected: boolean;
  delayed: boolean;
  lastFetchAt: number | null;
}
