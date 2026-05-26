import { Injectable } from '@angular/core';
import { ReplayFollowModeEngine } from './replay-follow-mode.engine';
import { LogicalRange, ReplayUserInteractionInput } from './replay-viewport.models';

@Injectable({ providedIn: 'root' })
export class ReplayInspectionEngine {
  constructor(private followMode: ReplayFollowModeEngine) {}

  /** User panned/zoomed away from replay head — detach viewport. */
  isDetachedFromHead(input: ReplayUserInteractionInput, tolerance = 3): boolean {
    const head = Math.max(0, input.replayIndex);
    const range = input.visibleRange;
    const headVisible = head >= range.from - tolerance && head <= range.to + tolerance;
    return !headVisible;
  }

  shouldEnterInspecting(input: ReplayUserInteractionInput): boolean {
    if (input.candleCount <= 0) return false;
    return this.isDetachedFromHead(input) || !this.isNearReplayHead(input);
  }

  private isNearReplayHead(input: ReplayUserInteractionInput): boolean {
    const head = Math.max(0, input.replayIndex);
    const range = input.visibleRange;
    const trailingEdge = range.to;
    return trailingEdge >= head - 1 && trailingEdge <= head + 8;
  }

  onUserInteraction(
    input: ReplayUserInteractionInput,
    currentAutoFollow: boolean
  ): { autoFollowReplay: false; detachedFromHead: boolean; savedRange: LogicalRange } {
    const detached = this.isDetachedFromHead(input) || !currentAutoFollow;
    return {
      autoFollowReplay: false,
      detachedFromHead: detached || this.shouldEnterInspecting(input),
      savedRange: { ...input.visibleRange }
    };
  }
}
