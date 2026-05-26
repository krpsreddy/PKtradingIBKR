import { Injectable } from '@angular/core';
import { ReplayFollowModeEngine } from './replay-follow-mode.engine';
import { ReplayInspectionEngine } from './replay-inspection.engine';
import { ReplayPlaybackSyncEngine } from './replay-playback-sync.engine';
import { ReplayVisibleRangeEngine } from './replay-visible-range.engine';
import { ReplayViewportPersistenceService } from './replay-viewport-persistence.service';
import { ReplayViewportStateService } from './replay-viewport-state.service';
import {
  DEFAULT_REPLAY_VIEWPORT_STATE,
  LogicalRange,
  ReplayInteractionMode,
  ReplayUserInteractionInput,
  ReplayViewportPlan,
  ReplayViewportState,
  ReplayViewportSyncDecision,
  ReplayViewportTickInput
} from './replay-viewport.models';

@Injectable({ providedIn: 'root' })
export class ReplayUxSynthesisService {
  private sessionArmed = false;

  constructor(
    private state: ReplayViewportStateService,
    private followMode: ReplayFollowModeEngine,
    private visibleRange: ReplayVisibleRangeEngine,
    private inspection: ReplayInspectionEngine,
    private playbackSync: ReplayPlaybackSyncEngine,
    private persistence: ReplayViewportPersistenceService
  ) {}

  get state$() {
    return this.state.state$;
  }

  snapshot(): ReplayViewportState {
    return this.state.snapshot();
  }

  onReplaySessionStart(symbol: string, sessionDate: string, replayIndex: number): void {
    this.playbackSync.reset();
    const savedRange = this.persistence.load(symbol, sessionDate);
    this.state.patch({
      ...DEFAULT_REPLAY_VIEWPORT_STATE,
      symbol,
      sessionDate,
      replayIndex,
      autoFollowReplay: true,
      mode: 'PAUSED',
      savedRange
    });
    this.sessionArmed = true;
  }

  onReplaySessionEnd(): void {
    this.sessionArmed = false;
    this.playbackSync.reset();
    this.state.reset();
  }

  onPlay(): void {
    const snap = this.state.snapshot();
    const autoFollow = !snap.detachedFromHead;
    const mode: ReplayInteractionMode = autoFollow ? 'PLAYING' : 'DETACHED_VIEW';
    this.state.patch({
      replayPlaying: true,
      mode,
      autoFollowReplay: autoFollow
    });
  }

  onPause(): void {
    const snap = this.state.snapshot();
    const mode: ReplayInteractionMode = snap.detachedFromHead ? 'INSPECTING' : 'PAUSED';
    this.state.patch({
      replayPlaying: false,
      mode
    });
  }

  onJumpToHead(replayIndex: number, candleCount: number, candleHighs: number[], candleLows: number[]): ReplayViewportPlan {
    const snap = this.state.snapshot();
    const plan = this.playbackSync.buildJumpPlan({
      replayIndex,
      candleCount,
      playing: snap.replayPlaying,
      symbol: snap.symbol,
      sessionDate: snap.sessionDate,
      candleHighs,
      candleLows,
      isInitial: false
    });
    const range: LogicalRange = { from: plan.visibleFrom, to: plan.visibleTo };
    this.persistence.save(snap.symbol, snap.sessionDate, range);
    this.state.patch({
      replayIndex,
      autoFollowReplay: true,
      detachedFromHead: false,
      savedRange: range,
      mode: snap.replayPlaying ? 'PLAYING' : 'FOLLOWING_HEAD'
    });
    return plan;
  }

  onSnapToBar(
    barIndex: number,
    candleCount: number,
    candleHighs: number[],
    candleLows: number[]
  ): ReplayViewportPlan {
    const snap = this.state.snapshot();
    const range = this.visibleRange.snapCenterRange(barIndex, candleCount);
    const plan = this.visibleRange.buildPlan(range, candleHighs, candleLows);
    this.persistence.save(snap.symbol, snap.sessionDate, range);
    this.state.patch({
      replayIndex: barIndex,
      autoFollowReplay: false,
      detachedFromHead: false,
      savedRange: range,
      mode: 'INSPECTING'
    });
    return { ...plan, animate: true };
  }

  onSignalInspection(): void {
    this.state.patch({
      autoFollowReplay: false,
      detachedFromHead: true,
      mode: 'INSPECTING'
    });
  }

  onUserViewportChange(input: ReplayUserInteractionInput): void {
    if (!this.sessionArmed) return;
    const snap = this.state.snapshot();
    const result = this.inspection.onUserInteraction(input, snap.autoFollowReplay);
    this.persistence.save(snap.symbol, snap.sessionDate, result.savedRange);
    const mode: ReplayInteractionMode = input.playing ? 'DETACHED_VIEW' : 'INSPECTING';
    this.state.patch({
      autoFollowReplay: result.autoFollowReplay,
      detachedFromHead: result.detachedFromHead,
      savedRange: result.savedRange,
      mode
    });
  }

  onReplayTick(input: ReplayViewportTickInput): ReplayViewportSyncDecision {
    if (!this.sessionArmed) {
      this.onReplaySessionStart(input.symbol, input.sessionDate, input.replayIndex);
    }

    const snap = this.state.patch({
      replayIndex: input.replayIndex,
      replayPlaying: input.playing,
      symbol: input.symbol,
      sessionDate: input.sessionDate
    });

    const decision = this.playbackSync.onTick(
      input,
      snap.mode,
      snap.autoFollowReplay,
      snap.savedRange
    );

    if (decision.shouldSyncViewport && decision.plan) {
      const range: LogicalRange = {
        from: decision.plan.visibleFrom,
        to: decision.plan.visibleTo
      };
      this.persistence.save(input.symbol, input.sessionDate, range);
      this.state.patch({ savedRange: range });
      if (snap.mode === 'FOLLOWING_HEAD' && input.playing) {
        this.state.setMode('PLAYING');
      }
    }

    return decision;
  }

  shouldBlockLiveViewport(): boolean {
    const mode = this.state.snapshot().mode;
    return this.followMode.isViewportLocked(mode);
  }

  minimapSnapshot(candleCount: number): {
    headPct: number;
    viewportFromPct: number;
    viewportToPct: number;
  } | null {
    const snap = this.state.snapshot();
    if (candleCount <= 0 || snap.replayIndex < 0) return null;
    const range = snap.savedRange ?? this.visibleRange.initialRange(snap.replayIndex, candleCount);
    const span = Math.max(1, candleCount + 2);
    return {
      headPct: (snap.replayIndex / span) * 100,
      viewportFromPct: (Math.max(0, range.from) / span) * 100,
      viewportToPct: (Math.min(span, range.to) / span) * 100
    };
  }
}
