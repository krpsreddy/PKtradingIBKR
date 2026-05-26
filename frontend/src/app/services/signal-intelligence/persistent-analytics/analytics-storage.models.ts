import { SignalSnapshot } from '../../../models/signal-intelligence.model';

/** Phase 147 — persistent analytics storage models (advisory only). */

export const ANALYTICS_STORAGE_VERSION = 1;

export interface AnalyticsVersionInfo {
  currentVersion: number;
  evaluatedSnapshotCount: number;
  playbookCandidateCount: number;
  stale: boolean;
}

export interface BulkUpsertResult {
  upserted: number;
  skipped: number;
  analyticsVersion: number;
}

export interface EvaluatedSnapshotPage {
  signals: SignalSnapshot[];
  page: number;
  size: number;
  totalElements: number;
  analyticsVersion: number;
  authoritative: boolean;
}

export interface PersistedHydrationSession {
  symbol: string;
  lookbackDays: number | null;
  candlesLoaded: number | null;
  signalsEvaluated: number | null;
  status: string;
  evaluatedSessionDates: string[];
  analyticsVersion: number;
  startedAt: string | null;
  completedAt: string | null;
  stale: boolean;
}

export interface StorageStats {
  evaluatedSnapshots: number;
  hydrationSessions: number;
  playbookCandidates: number;
  decisionFeedbackRows: number;
  analyticsVersion: number;
}

export interface AnalyticsSyncState {
  bootstrapped: boolean;
  syncing: boolean;
  lastSyncAt: number | null;
  serverVersion: number | null;
  stale: boolean;
  error: string | null;
}
