import { Injectable } from '@angular/core';
import { LogicalRange, REPLAY_VIEWPORT_FORWARD_PAD, REPLAY_VIEWPORT_WINDOW } from '../chart/replay-viewport/replay-viewport.models';

/** Deterministic center-on-candle viewport planning (Phase 154). */
@Injectable({ providedIn: 'root' })
export class ReplayChartSnappingEngine {
  centeredRange(targetIndex: number, candleCount: number, visibleBars = REPLAY_VIEWPORT_WINDOW): LogicalRange {
    const head = Math.max(0, Math.min(targetIndex, Math.max(0, candleCount - 1)));
    const span = Math.max(24, visibleBars);
    const half = Math.floor(span / 2);
    let from = Math.max(0, head - half);
    let to = from + span;
    const maxTo = Math.max(candleCount, 1) + REPLAY_VIEWPORT_FORWARD_PAD;
    if (to > maxTo) {
      to = maxTo;
      from = Math.max(0, to - span);
    }
    return { from, to: Math.max(from + 8, to) };
  }
}
