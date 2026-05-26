export interface ReplaySignalEvent {
  timestamp: string;
  signalType: string;
  lifecycleState: string;
  score: number | null;
  setupLabel: string | null;
  passedConditions: string[];
  failedConditions: string[];
  price: number;
  rvol: number | null;
  vwap: number | null;
  vwapState: string | null;
  trend: string | null;
  extended: boolean;
  conditions: Record<string, boolean>;
}

export interface ReplayScorePoint {
  timestamp: string;
  engine: string;
  score: number;
  scoreLabel: string;
}

export interface ReplayHistory {
  symbol: string;
  replayDate: string;
  timeframe: string;
  totalBars: number;
  simulatedSignals: number;
  sessionCandles: import('./candle.model').Candle[];
  timeline: ReplaySignalEvent[];
  scoreHistory: ReplayScorePoint[];
  lifecyclePath: string[];
}

export interface BulkReplayHistory {
  symbol: string;
  lookbackDays: number;
  sessionsProcessed: number;
  sessionsWithSignals: number;
  totalSignals: number;
  candlesStored?: number;
  historyStatus?: string;
  historyMessage?: string;
  sessions: ReplayHistory[];
}

export type ReplaySpeed = 1 | 2 | 5 | 10;
