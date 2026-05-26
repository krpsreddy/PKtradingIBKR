export type ExecutionState =
  | 'WATCHING'
  | 'READY'
  | 'TRIGGERED'
  | 'MANAGING'
  | 'SCALING'
  | 'EXITING'
  | 'REVIEWING';

export interface ExecutionStateContext {
  replayMode: boolean;
  hasValidSetup: boolean;
  trustScore: number | null;
  failurePct: number | null;
  continuationCurrent: number | null;
  continuationStart: number | null;
  estimatedRr: number | null;
  freshness: string | null;
  relativeVolume: number | null;
  regimeAligned: boolean | null;
  tradeActive: boolean;
  setupMaturity: string | null;
  adaptiveExit: string | null;
  deterioration: string | null;
  noEdge: boolean;
  nearTrigger: boolean;
  triggerActive?: boolean;
}

export interface ExecutionStateSnapshot {
  state: ExecutionState;
  previous: ExecutionState | null;
  changedAt: number;
}

export const EXECUTION_STATE_FLOW: ExecutionState[] = [
  'WATCHING', 'READY', 'TRIGGERED', 'MANAGING', 'SCALING', 'EXITING'
];
