import { ReplayHistory } from '../../../models/replay.model';

/** Phase 149 — replay cache models (performance infrastructure only). */

export type ReplaySnapshotStatus = 'READY' | 'STALE' | 'MISSING' | 'PROCESSING' | 'FAILED';

export interface ReplaySnapshotSummary {
  symbol: string;
  sessionDate: string;
  analyticsVersion: number;
  candlesHash: string;
  replayStatus: ReplaySnapshotStatus | string;
  totalBars: number;
  simulatedSignals: number;
  stale: boolean;
}

export interface SymbolSnapshotPage {
  symbol: string;
  analyticsVersion: number;
  totalSessions: number;
  readySessions: number;
  staleSessions: number;
  missingSessions: number;
  sessions: ReplaySnapshotSummary[];
}

export interface StaleSessionsResponse {
  symbol: string;
  analyticsVersion: number;
  staleDates: string[];
  missingDates: string[];
  readyCount: number;
}

export interface IncrementalReplayResponse {
  symbol: string;
  lookbackDays: number;
  sessionsProcessed: number;
  sessionsFromCache: number;
  sessionsReplayed: number;
  sessionsWithSignals: number;
  totalSignals: number;
  candlesStored: number;
  historyStatus: string;
  historyMessage: string;
  sessions: ReplayHistory[];
}

export type HydrationCachePhase =
  | 'snapshots'
  | 'validate'
  | 'stale-replay'
  | 'evaluate'
  | 'enrich';

export interface ReplayCacheState {
  symbol: string;
  readySessions: number;
  staleSessions: number;
  missingSessions: number;
  lastLoadedAt: number | null;
  cacheHit: boolean;
}

export const REPLAY_CACHE_STORAGE_KEY = 'replay-snapshot-cache-v1';

export interface ReplaySessionSummaryApi {
  sessionDate: string;
  signalCount: number;
  convictionAvg: number | null;
  replayReady: boolean;
  stale: boolean;
  bestDecision: string | null;
  bestNarrative: string | null;
  expectancy: number | null;
  status: string;
}
