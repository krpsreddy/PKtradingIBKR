import { ReplayHistory, ReplaySignalEvent } from '../../models/replay.model';
import { Candle } from '../../models/candle.model';
import { ReplaySnapshotSummary } from '../signal-intelligence/replay-cache/replay-cache.models';
import { ReplayContextMode } from '../replay-decision-visualization/replay-decision-visualization.models';

export type ReplayWorkstationMode = 'SINGLE_SESSION' | 'MULTI_DAY_CONTINUOUS';
export type ReplayDisplayMode = 'PLAYBACK' | 'REVIEW' | 'TRAINING';
export type ReplayStartMode =
  | 'SMART'
  | 'OPEN'
  | 'FIRST_SIGNAL'
  | 'FIRST_ENTRY'
  | 'VWAP_RECLAIM'
  | 'SECOND_LEG'
  | 'CUSTOM_TIME';

export type ReplaySignalJumpKind =
  | 'NEXT_SIGNAL'
  | 'PREV_SIGNAL'
  | 'NEXT_ENTRY'
  | 'PREV_ENTRY'
  | 'NEXT_TRAP'
  | 'NEXT_RECLAIM'
  | 'NEXT_SECOND_LEG';

export interface CrossSessionJumpTarget {
  sessionDate: string;
  barIndex: number;
}

export interface ReplaySessionCatalogEntry {
  sessionDate: string;
  signalCount: number;
  totalBars: number;
  replayReady: boolean;
  stale: boolean;
  bestSetup: string | null;
  label: string;
  status?: string;
  convictionAvg?: number | null;
  healthLabel?: string;
}

export interface ReplaySignalVisibility {
  entries: boolean;
  exits: boolean;
  narratives: boolean;
  decisions: boolean;
  calibration: boolean;
  playbooks: boolean;
  institutionalFlow: boolean;
}

export const DEFAULT_SIGNAL_VISIBILITY: ReplaySignalVisibility = {
  entries: true,
  exits: true,
  narratives: true,
  decisions: true,
  calibration: true,
  playbooks: true,
  institutionalFlow: true
};

export interface ReplayWorkstationState {
  symbol: string;
  workstationMode: ReplayWorkstationMode;
  displayMode: ReplayDisplayMode;
  startMode: ReplayStartMode;
  selectedSessionDate: string | null;
  sessions: ReplaySessionCatalogEntry[];
  cursorIndex: number;
  loading: boolean;
  error: string | null;
  history: ReplayHistory | null;
  priorSession: ReplayHistory | null;
  priorSessions: ReplayHistory[];
  contextMode: ReplayContextMode;
  sessionStartIndex: number;
  visibility: ReplaySignalVisibility;
  cacheHit: boolean;
}

export const DEFAULT_WORKSTATION_STATE: ReplayWorkstationState = {
  symbol: '',
  workstationMode: 'SINGLE_SESSION',
  displayMode: 'PLAYBACK',
  startMode: 'SMART',
  selectedSessionDate: null,
  sessions: [],
  cursorIndex: -1,
  loading: false,
  error: null,
  history: null,
  priorSession: null,
  priorSessions: [],
  contextMode: 'PREVIOUS_DAY',
  sessionStartIndex: 0,
  visibility: { ...DEFAULT_SIGNAL_VISIBILITY },
  cacheHit: false
};

export interface ReplayDisplayContext {
  candles: Candle[];
  signals: import('../../models/signal.model').TradingSignal[];
  timeline: ReplaySignalEvent[];
  cursorIndex: number;
  reviewMode: boolean;
  sessionStartIndex: number;
}

export function catalogFromSummary(s: ReplaySnapshotSummary): ReplaySessionCatalogEntry {
  const loadable = s.totalBars > 0 || (s.replayStatus !== 'MISSING' && s.replayStatus !== 'FAILED');
  return {
    sessionDate: s.sessionDate,
    signalCount: s.simulatedSignals,
    totalBars: s.totalBars,
    replayReady: loadable,
    stale: s.stale,
    bestSetup: s.simulatedSignals > 0 ? `${s.simulatedSignals} signals` : null,
    label: formatSessionLabel(s.sessionDate)
  };
}

export function formatSessionLabel(isoDate: string): string {
  try {
    const d = new Date(isoDate + 'T12:00:00');
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
  } catch {
    return isoDate;
  }
}
