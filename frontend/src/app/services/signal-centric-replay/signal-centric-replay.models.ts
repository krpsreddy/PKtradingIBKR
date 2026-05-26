/** Phase 155 — Signal-centric replay navigation models. */

export type SignalDecisionType =
  | 'FULL_EXECUTION'
  | 'PROBING'
  | 'WAIT'
  | 'TRAP_RISK'
  | 'REDUCE_SIZE'
  | 'EXIT'
  | 'STOP';

export type SignalSetupType =
  | 'VWAP_RECLAIM'
  | 'SECOND_LEG'
  | 'OPEN_MOMENTUM'
  | 'FAILED_BREAKOUT'
  | 'TREND_CONTINUATION';

export type SignalEntryQuality = 'IDEAL' | 'INSTITUTIONAL' | 'EXTENDED' | 'TRAP';

export type SignalVisualTone = 'win' | 'reclaim' | 'wait' | 'trap' | 'elite' | 'neutral';

export type SignalReplayMode = 'REVIEW_SIGNAL' | 'TRAIN_FROM_SIGNAL';

export type SignalConvictionBand = 'ALL' | 'ELITE' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ReplaySignalIndexRow {
  signalId: string;
  symbol: string;
  sessionDate: string;
  timestamp: number;
  timestampIso: string;
  replayIndex: number;
  candleIndex: number;
  decision: SignalDecisionType | string;
  setup: SignalSetupType | string;
  narrative: string;
  conviction: number | null;
  entryQuality: SignalEntryQuality | string | null;
  resultR: number | null;
  mfe: number | null;
  mae: number | null;
  replayReady: boolean;
  replaySnapshotId: string | null;
  winLoss: string | null;
  lifecycleState: string | null;
  journeySteps: string[];
}

export interface ReplaySignalIndexPage {
  rows: ReplaySignalIndexRow[];
  total: number;
  page: number;
  size: number;
  generatedAt: number;
  analyticsVersion: number;
}

export interface SignalCentricFilters {
  decision: string;
  narrative: string;
  quality: string;
  result: string;
  conviction: SignalConvictionBand;
  timeWindowDays: number;
  searchText: string;
  sort: 'TIME_DESC' | 'CONVICTION' | 'RESULT_R';
}

export interface SignalCentricRow extends ReplaySignalIndexRow {
  timeLabel: string;
  dateLabel: string;
  signalLabel: string;
  qualityLabel: string;
  convictionLabel: string;
  resultLabel: string;
  visualTone: SignalVisualTone;
  rankScore: number;
}

export interface SignalReplayLaunchContext {
  signalId: string;
  symbol: string;
  sessionDate: string;
  replayIndex: number;
  candleIndex: number;
  replayMode: SignalReplayMode;
  barsBeforeSignal: number;
  openReviewMode: boolean;
  centerViewport: boolean;
  pauseReplay: boolean;
  journeySteps: string[];
  highlightEntryIndex: number | null;
  highlightExitIndex: number | null;
  snapshotId: string | null;
}

export interface SignalCentricExplorerState {
  symbol: string;
  loading: boolean;
  error: string | null;
  filters: SignalCentricFilters;
  rows: SignalCentricRow[];
  filteredRows: SignalCentricRow[];
  totalSignals: number;
  selectedSignalId: string | null;
  activeLaunch: SignalReplayLaunchContext | null;
  generatedAt: number | null;
}

export type SignalSmartShortcut =
  | 'BEST_WINNERS'
  | 'BIGGEST_FAILURES'
  | 'ELITE_RECLAIMS'
  | 'TRAP_DAYS'
  | 'HIGH_CONVICTION'
  | 'FAILED_HIGH_CONVICTION'
  | 'BEST_SECOND_LEGS';

export const DEFAULT_SIGNAL_CENTRIC_FILTERS: SignalCentricFilters = {
  decision: 'ALL',
  narrative: 'ALL',
  quality: 'ALL',
  result: 'ALL',
  conviction: 'ALL',
  timeWindowDays: 60,
  searchText: '',
  sort: 'TIME_DESC'
};

export const DEFAULT_SIGNAL_CENTRIC_STATE: SignalCentricExplorerState = {
  symbol: '',
  loading: false,
  error: null,
  filters: { ...DEFAULT_SIGNAL_CENTRIC_FILTERS },
  rows: [],
  filteredRows: [],
  totalSignals: 0,
  selectedSignalId: null,
  activeLaunch: null,
  generatedAt: null
};
