import { Injectable } from '@angular/core';
import {
  LogicalRange,
  REPLAY_VIEWPORT_FORWARD_PAD,
  REPLAY_VIEWPORT_WINDOW,
  ReplayViewportPlan
} from './replay-viewport.models';

@Injectable({ providedIn: 'root' })
export class ReplayVisibleRangeEngine {
  initialRange(replayIndex: number, candleCount: number): LogicalRange {
    const head = Math.max(0, replayIndex);
    const from = Math.max(0, head - REPLAY_VIEWPORT_WINDOW);
    const minSpan = REPLAY_VIEWPORT_WINDOW + REPLAY_VIEWPORT_FORWARD_PAD;
    const to = Math.max(head + REPLAY_VIEWPORT_FORWARD_PAD, from + minSpan, 2);
    return {
      from,
      to: Math.min(Math.max(candleCount, 1) + REPLAY_VIEWPORT_FORWARD_PAD, to)
    };
  }

  followRange(replayIndex: number, candleCount: number, current?: LogicalRange | null): LogicalRange {
    const head = Math.max(0, replayIndex);
    const span = current
      ? Math.max(REPLAY_VIEWPORT_WINDOW, current.to - current.from)
      : REPLAY_VIEWPORT_WINDOW + REPLAY_VIEWPORT_FORWARD_PAD;
    const forwardPad = Math.min(REPLAY_VIEWPORT_FORWARD_PAD, Math.max(2, Math.floor(span * 0.12)));
    let from = Math.max(0, head - Math.floor(span * 0.72));
    let to = from + span;
    if (head + forwardPad > to - 2) {
      to = head + forwardPad + 2;
      from = Math.max(0, to - span);
    }
    return {
      from,
      to: Math.min(candleCount + REPLAY_VIEWPORT_FORWARD_PAD, to)
    };
  }

  jumpToHeadRange(replayIndex: number, candleCount: number): LogicalRange {
    return this.initialRange(replayIndex, candleCount);
  }

  snapCenterRange(replayIndex: number, candleCount: number, visibleBars = REPLAY_VIEWPORT_WINDOW): LogicalRange {
    const head = Math.max(0, Math.min(replayIndex, Math.max(0, candleCount - 1)));
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

  buildPlan(
    range: LogicalRange,
    candleHighs: number[],
    candleLows: number[]
  ): ReplayViewportPlan {
    const fromIdx = Math.max(0, Math.floor(range.from));
    const toIdx = Math.min(candleHighs.length - 1, Math.ceil(range.to));
    let priceMin: number | null = null;
    let priceMax: number | null = null;

    if (candleHighs.length > 0 && toIdx >= fromIdx) {
      const highs = candleHighs.slice(fromIdx, toIdx + 1);
      const lows = candleLows.slice(fromIdx, toIdx + 1);
      if (highs.length) {
        const hi = Math.max(...highs);
        const lo = Math.min(...lows);
        const span = Math.max(hi - lo, hi * 0.0012);
        const fill = 0.625;
        const padEach = (span * (1 - fill)) / (2 * fill);
        priceMin = lo - padEach;
        priceMax = hi + padEach;
      }
    }

    return {
      visibleFrom: range.from,
      visibleTo: range.to,
      priceMin,
      priceMax,
      scaleMargins: { top: 0.12, bottom: 0.10 },
      rightOffset: 3
    };
  }
}
