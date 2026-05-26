import { Injectable } from '@angular/core';
import { ReplayVisibleRangeEngine } from '../chart/replay-viewport/replay-visible-range.engine';
import { ReplayViewportPlan } from '../chart/replay-viewport/replay-viewport.models';
import { ReplayChartSnappingEngine } from './replay-chart-snapping.engine';
import { ReplaySnapRequest } from './replay-ux.models';

export interface SnapViewportInput {
  barIndex: number;
  candleCount: number;
  candleHighs: number[];
  candleLows: number[];
}

@Injectable({ providedIn: 'root' })
export class ReplayFocusManagerService {
  constructor(
    private snapping: ReplayChartSnappingEngine,
    private visibleRange: ReplayVisibleRangeEngine
  ) {}

  buildSnapPlan(input: SnapViewportInput): ReplayViewportPlan {
    const range = this.snapping.centeredRange(input.barIndex, input.candleCount);
    return {
      ...this.visibleRange.buildPlan(range, input.candleHighs, input.candleLows),
      animate: true
    };
  }

  effectiveBarIndex(request: ReplaySnapRequest, sessionStartIndex: number): number {
    return sessionStartIndex + Math.max(0, request.barIndex);
  }
}
