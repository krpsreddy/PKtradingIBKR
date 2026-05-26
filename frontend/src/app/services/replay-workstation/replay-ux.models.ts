/** Phase 154 — replay workstation UX models. */

export type ReplayUxStatus =
  | 'READY'
  | 'LOADING_SESSION'
  | 'SNAPPING_TO_SIGNAL'
  | 'APPLYING_CONTEXT'
  | 'PLAYING'
  | 'PAUSED'
  | 'REVIEW_MODE';

export type ReplayPanelTab =
  | 'timeline'
  | 'decisions'
  | 'lifecycle'
  | 'inspector'
  | 'scores'
  | 'explorer';

export type ReplayWorkstationViewMode = 'REVIEW' | 'STUDY' | 'TRAINING' | 'TIMELINE';

export interface ReplayBreadcrumb {
  symbol: string;
  sessionDate: string;
  sessionLabel: string;
  timeLabel: string;
  decisionLabel: string;
  narrativeLabel: string;
  convictionPct: number | null;
}

export interface ReplayActionFeedback {
  message: string;
  startedAt: number;
  kind: 'loading' | 'snap' | 'session' | 'symbol' | 'jump';
}

export interface ReplayDebugInfo {
  replayIndex: number;
  visibleFrom: number | null;
  visibleTo: number | null;
  focusedSignal: string | null;
  autoFollow: boolean;
  viewportLock: boolean;
}

export interface ReplayPanelLayoutState {
  activeTab: ReplayPanelTab;
  pinnedTab: ReplayPanelTab | null;
  bottomExpanded: boolean;
  explorerOpen: boolean;
}

export interface ReplaySnapRequest {
  barIndex: number;
  reason: string;
  animate?: boolean;
  highlight?: boolean;
}

export const REPLAY_SNAP_LOCK_MS = 300;
export const REPLAY_SNAP_ANIM_MS = 250;
export const REPLAY_UX_DEBOUNCE_MS = 50;

export const DEFAULT_PANEL_LAYOUT: ReplayPanelLayoutState = {
  activeTab: 'timeline',
  pinnedTab: null,
  bottomExpanded: true,
  explorerOpen: false
};
