import { Injectable } from '@angular/core';
import { ReplayFollowModeEngine } from './replay-follow-mode.engine';
import { ReplayVisibleRangeEngine } from './replay-visible-range.engine';
import {
  LogicalRange,
  REPLAY_VIEWPORT_SYNC_MS,
  ReplayViewportPlan,
  ReplayViewportSyncDecision,
  ReplayViewportTickInput
} from './replay-viewport.models';

@Injectable({ providedIn: 'root' })
export class ReplayPlaybackSyncEngine {
  private lastSyncAt = 0;
  private pendingRaf = 0;
  private lastAppliedIndex = -1;

  constructor(
    private followMode: ReplayFollowModeEngine,
    private visibleRange: ReplayVisibleRangeEngine
  ) {}

  reset(): void {
    this.lastSyncAt = 0;
    this.lastAppliedIndex = -1;
    if (this.pendingRaf) {
      cancelAnimationFrame(this.pendingRaf);
      this.pendingRaf = 0;
    }
  }

  onTick(
    input: ReplayViewportTickInput,
    mode: string,
    autoFollow: boolean,
    savedRange: LogicalRange | null
  ): ReplayViewportSyncDecision {
    if (input.isInitial) {
      const range = savedRange ?? this.visibleRange.initialRange(input.replayIndex, input.candleCount);
      this.lastAppliedIndex = input.replayIndex;
      return {
        shouldSyncViewport: true,
        plan: this.visibleRange.buildPlan(range, input.candleHighs, input.candleLows),
        animate: false
      };
    }

    if (!this.followMode.allowsViewportMutation(mode as never) || !autoFollow) {
      return { shouldSyncViewport: false, plan: null, animate: false };
    }

    if (input.replayIndex === this.lastAppliedIndex) {
      return { shouldSyncViewport: false, plan: null, animate: false };
    }

    const now = performance.now();
    if (now - this.lastSyncAt < REPLAY_VIEWPORT_SYNC_MS) {
      return { shouldSyncViewport: false, plan: null, animate: false };
    }

    const range = this.visibleRange.followRange(input.replayIndex, input.candleCount, savedRange);
    this.lastSyncAt = now;
    this.lastAppliedIndex = input.replayIndex;
    return {
      shouldSyncViewport: true,
      plan: this.visibleRange.buildPlan(range, input.candleHighs, input.candleLows),
      animate: mode === 'FOLLOWING_HEAD'
    };
  }

  buildJumpPlan(input: ReplayViewportTickInput): ReplayViewportPlan {
    const range = this.visibleRange.jumpToHeadRange(input.replayIndex, input.candleCount);
    this.lastAppliedIndex = input.replayIndex;
    this.lastSyncAt = performance.now();
    return {
      ...this.visibleRange.buildPlan(range, input.candleHighs, input.candleLows),
      animate: true
    };
  }
}
