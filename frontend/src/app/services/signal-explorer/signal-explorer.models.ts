/** Phase 153 — Global Signal Explorer models. */

export type SignalSideFilter = 'ALL' | 'BUY' | 'SELL';

export type SignalDecisionFilter =
  | 'ALL'
  | 'FULL_EXECUTION'
  | 'PROBING_EXECUTION'
  | 'RECLAIM_ENTRY'
  | 'SECOND_LEG'
  | 'BREAKOUT'
  | 'VWAP_RECLAIM'
  | 'TREND_CONTINUATION'
  | 'TRAP_RISK'
  | 'EXIT_NOW'
  | 'STOP_HIT'
  | 'TARGET_HIT';

export type SignalNarrativeFilter =
  | 'ALL'
  | 'VWAP_RECLAIM'
  | 'FAILED_BREAKOUT'
  | 'SECOND_LEG'
  | 'ACCEPTANCE'
  | 'TREND_CONTINUATION'
  | 'EXHAUSTION';

export type SignalQualityFilter =
  | 'ALL'
  | 'ELITE'
  | 'HIGH'
  | 'INSTITUTIONAL'
  | 'LOW_FAKEOUT'
  | 'HIGH_EXPECTANCY';

export type SignalResultFilter =
  | 'ALL'
  | 'WINNERS'
  | 'LOSERS'
  | 'GT_2R'
  | 'TRAP_AVOIDED'
  | 'FAKEOUTS';

export type SignalTimeWindow = 'TODAY' | '5D' | '20D' | '60D';

export type SignalSortMode = 'TIME_DESC' | 'CONVICTION' | 'EXPECTANCY' | 'ACTUAL_R';

export interface HistoricalSignalRecord {
  signalId: string;
  symbol: string;
  sessionDate: string;
  timestamp: string;
  timestampMs: number;
  decision: string;
  narrative: string;
  signalType?: string;
  conviction: number | null;
  expectancy: number | null;
  actualR: number | null;
  velocity?: number | null;
  fakeoutRisk: number | null;
  entryQuality: string | null;
  replayReady: boolean;
  replayIndex: number;
  snapshotId: string | null;
}

export interface SignalExplorerRow extends HistoricalSignalRecord {
  timeLabel: string;
  dateLabel: string;
  signalLabel: string;
  action?: string;
  velocityLabel?: string;
  resultLabel: string;
  resultClass: 'win' | 'loss' | 'neutral';
  rankScore: number;
}

export interface SignalExplorerFilters {
  side: SignalSideFilter;
  decision: SignalDecisionFilter;
  narrative: SignalNarrativeFilter;
  quality: SignalQualityFilter;
  result: SignalResultFilter;
  timeWindow: SignalTimeWindow;
  highConvictionOnly: boolean;
  searchText: string;
  sort: SignalSortMode;
}

export interface SignalCluster {
  id: string;
  label: string;
  narrative: string;
  count: number;
  avgR: number;
  avgConviction: number;
  signalIds: string[];
}

export interface SignalExplorerDiscovery {
  bestExpectancy: SignalExplorerRow[];
  highestConviction: SignalExplorerRow[];
  bestSecondLeg: SignalExplorerRow[];
  safestReclaims: SignalExplorerRow[];
  dangerousTraps: SignalExplorerRow[];
  worstChases: SignalExplorerRow[];
  clusters: SignalCluster[];
}

export interface SignalReplayLaunchPlan {
  signalId: string;
  symbol: string;
  sessionDate: string;
  replayIndex: number;
  openReviewMode: boolean;
  centerViewport: boolean;
  pauseReplay: boolean;
  /** Phase 155 — review vs train-from-signal mode */
  replayMode?: 'REVIEW_SIGNAL' | 'TRAIN_FROM_SIGNAL';
  barsBeforeSignal?: number;
  candleIndex?: number;
  /** When replayIndex is unknown, dashboard resolves bar from session candles. */
  timestampMs?: number;
  journeySteps?: string[];
}

export interface SignalExplorerState {
  symbol: string;
  loading: boolean;
  error: string | null;
  filters: SignalExplorerFilters;
  rows: SignalExplorerRow[];
  filteredRows: SignalExplorerRow[];
  selectedSignalId: string | null;
  selectedIndex: number;
  discovery: SignalExplorerDiscovery | null;
  bulkReviewActive: boolean;
}

export interface HistoricalSignalSearchPage {
  signals: HistoricalSignalRecord[];
  page: number;
  size: number;
  totalElements: number;
  analyticsVersion: number;
}

export const DEFAULT_SIGNAL_EXPLORER_FILTERS: SignalExplorerFilters = {
  side: 'ALL',
  decision: 'ALL',
  narrative: 'ALL',
  quality: 'ALL',
  result: 'ALL',
  timeWindow: '60D',
  highConvictionOnly: false,
  searchText: '',
  sort: 'TIME_DESC'
};

export const DEFAULT_SIGNAL_EXPLORER_STATE: SignalExplorerState = {
  symbol: '',
  loading: false,
  error: null,
  filters: { ...DEFAULT_SIGNAL_EXPLORER_FILTERS },
  rows: [],
  filteredRows: [],
  selectedSignalId: null,
  selectedIndex: -1,
  discovery: null,
  bulkReviewActive: false
};
