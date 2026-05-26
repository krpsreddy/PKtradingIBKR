/** Phase 135 — bulk history hydration models (incremental · resumable). */

export type HydrationStatus = 'NOT_STARTED' | 'PARTIAL' | 'LOADING' | 'READY' | 'FAILED';

export type HydrationQueueState =
  | 'QUEUED'
  | 'LOADING'
  | 'RETRYING'
  | 'READY'
  | 'FAILED'
  | 'SKIPPED';

export interface MissingHistoryRange {
  start: number;
  end: number;
  label: string;
}

export interface SymbolHistoryHydrationState {
  symbol: string;
  earliestLoadedTimestamp: number | null;
  latestLoadedTimestamp: number | null;
  loadedDays: number;
  targetDays: number;
  hydrationStatus: HydrationStatus;
  lastHydratedAt: number | null;
  missingRanges: MissingHistoryRange[];
  totalCandlesLoaded: number;
  replayEvaluated: boolean;
  aiAnalyzed: boolean;
  evaluatedSessionDates: string[];
  signalCount: number;
  queueState: HydrationQueueState;
  error?: string;
  /** Transient UI label during LOADING (replay / evaluate / analyze). */
  currentPhase?: string | null;
}

export interface SymbolHistoryCoverage {
  symbol: string;
  lookbackDays: number;
  loadedSessionDays: number;
  totalCandles: number;
  earliestTimestamp: string | null;
  latestTimestamp: string | null;
  sessionDates: string[];
  fullyLoaded: boolean;
  message: string;
}

export interface BulkHydrationProgress {
  running: boolean;
  totalSymbols: number;
  completed: number;
  skipped: number;
  failed: number;
  queueSize: number;
  currentSymbol: string | null;
  currentLabel: string | null;
  /** Symbols currently downloading replay / evaluating. */
  activeSymbols: string[];
  parallelism: number;
  autoAnalyze: boolean;
  startedAt: number | null;
  estimatedRemainingMs: number | null;
  /** Set when a bulk run finishes with nothing left to load. */
  summaryMessage?: string | null;
}

export interface BulkHydrationOptions {
  lookbackDays?: number;
  autoAnalyze?: boolean;
  force?: boolean;
  /** Active chart symbol — hydrated first. */
  prioritySymbol?: string;
  /** How many symbols to hydrate in parallel (default 4, max 6). */
  parallelism?: number;
}

export interface HydrationJobResult {
  symbol: string;
  skipped: boolean;
  recorded: number;
  sessions: number;
  loadedDays: number;
  error?: string;
}

export interface HydrationLabRow {
  symbol: string;
  historyLabel: string;
  historyComplete: boolean;
  signalCount: number;
  edgeScore: number;
  status: HydrationStatus;
  queueState: HydrationQueueState;
  statusDetail: string | null;
}

export const SYMBOL_HISTORY_HYDRATION_STORAGE_KEY = 'symbol-history-hydration-v1';
export const HYDRATION_QUEUE_STORAGE_KEY = 'symbol-history-hydration-queue-v1';

/** Target trading session days for full 60D calendar lookback. */
export const HYDRATION_TARGET_SESSION_DAYS = 39;

export const HYDRATION_THROTTLE_MIN_MS = 400;
export const HYDRATION_THROTTLE_MAX_MS = 1200;

/** Default parallel symbol hydration workers — replay download + evaluate. */
export const HYDRATION_PARALLEL_SYMBOLS = 4;
export const HYDRATION_PARALLEL_MAX = 6;
export const HYDRATION_SCAN_PARALLEL = 6;
