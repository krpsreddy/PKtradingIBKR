import { Injectable } from '@angular/core';
import { REPLAY_VIEWPORT_FORWARD_PAD, REPLAY_VIEWPORT_WINDOW } from '../chart/replay-viewport/replay-viewport.models';

export interface HistoryViewportRange {
  from: number;
  to: number;
}

/** Viewport planning for full-session replay (Phase 151). */
@Injectable({ providedIn: 'root' })
export class ReplayHistoryViewportEngine {
  initialRange(cursorIndex: number, totalBars: number): HistoryViewportRange {
    const head = Math.max(0, cursorIndex);
    const from = Math.max(0, head - REPLAY_VIEWPORT_WINDOW);
    const minSpan = REPLAY_VIEWPORT_WINDOW + REPLAY_VIEWPORT_FORWARD_PAD;
    const to = Math.max(head + REPLAY_VIEWPORT_FORWARD_PAD, from + minSpan);
    return {
      from,
      to: Math.min(Math.max(totalBars, 1) + REPLAY_VIEWPORT_FORWARD_PAD, to)
    };
  }

  /** Offset cursor index when prior-session context is prepended. */
  cursorWithContext(cursorIndex: number, priorBarCount: number): number {
    return priorBarCount + Math.max(0, cursorIndex);
  }
}
