/** Deterministic replay interaction states — replay cursor ≠ chart viewport. */
export type ReplayInteractionMode =
  | 'PLAYING'
  | 'PAUSED'
  | 'INSPECTING'
  | 'DETACHED_VIEW'
  | 'FOLLOWING_HEAD';

export interface LogicalRange {
  from: number;
  to: number;
}

export interface ReplayViewportPlan {
  visibleFrom: number;
  visibleTo: number;
  priceMin: number | null;
  priceMax: number | null;
  scaleMargins: { top: number; bottom: number };
  rightOffset: number;
  animate?: boolean;
}

export interface ReplayViewportState {
  mode: ReplayInteractionMode;
  autoFollowReplay: boolean;
  replayIndex: number;
  replayPlaying: boolean;
  detachedFromHead: boolean;
  symbol: string;
  sessionDate: string;
  savedRange: LogicalRange | null;
}

export interface ReplayViewportSyncDecision {
  shouldSyncViewport: boolean;
  plan: ReplayViewportPlan | null;
  animate: boolean;
}

export interface ReplayViewportTickInput {
  replayIndex: number;
  candleCount: number;
  playing: boolean;
  symbol: string;
  sessionDate: string;
  candleHighs: number[];
  candleLows: number[];
  isInitial: boolean;
}

export interface ReplayUserInteractionInput {
  visibleRange: LogicalRange;
  replayIndex: number;
  candleCount: number;
  playing: boolean;
}

export const REPLAY_VIEWPORT_WINDOW = 60;
export const REPLAY_VIEWPORT_FORWARD_PAD = 10;
export const REPLAY_VIEWPORT_SYNC_MS = 80;
export const REPLAY_VIEWPORT_STORAGE_KEY = 'replay-viewport-v1';

export const DEFAULT_REPLAY_VIEWPORT_STATE: ReplayViewportState = {
  mode: 'PAUSED',
  autoFollowReplay: true,
  replayIndex: -1,
  replayPlaying: false,
  detachedFromHead: false,
  symbol: '',
  sessionDate: '',
  savedRange: null
};
