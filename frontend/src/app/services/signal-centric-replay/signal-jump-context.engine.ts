import { Injectable } from '@angular/core';
import {
  ReplaySignalIndexRow,
  SignalCentricRow,
  SignalReplayLaunchContext,
  SignalReplayMode
} from './signal-centric-replay.models';
import { ReplayHistory } from '../../models/replay.model';

/** Builds precise replay jump context from index row. */
@Injectable({ providedIn: 'root' })
export class SignalJumpContextEngine {
  buildLaunchContext(
    row: ReplaySignalIndexRow | SignalCentricRow,
    mode: SignalReplayMode = 'REVIEW_SIGNAL',
    barsBeforeSignal = 10
  ): SignalReplayLaunchContext {
    const replayIndex = this.resolveReplayIndex(row);
    const trainIndex = mode === 'TRAIN_FROM_SIGNAL'
      ? Math.max(0, replayIndex - barsBeforeSignal)
      : replayIndex;

    return {
      signalId: row.signalId,
      symbol: row.symbol,
      sessionDate: row.sessionDate,
      replayIndex: trainIndex,
      candleIndex: replayIndex,
      replayMode: mode,
      barsBeforeSignal,
      openReviewMode: mode === 'REVIEW_SIGNAL',
      centerViewport: true,
      pauseReplay: true,
      journeySteps: row.journeySteps?.length ? row.journeySteps : this.inferJourney(row),
      highlightEntryIndex: replayIndex,
      highlightExitIndex: null,
      snapshotId: row.replaySnapshotId
    };
  }

  async resolveBarIndex(history: ReplayHistory, timestampMs: number): Promise<number> {
    if (!history?.sessionCandles?.length) return -1;
    let best = -1;
    let bestDelta = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < history.sessionCandles.length; i++) {
      const ms = new Date(history.sessionCandles[i].time).getTime();
      const delta = Math.abs(ms - timestampMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = i;
      }
    }
    return best;
  }

  private resolveReplayIndex(row: ReplaySignalIndexRow): number {
    if (row.replayIndex >= 0) return row.replayIndex;
    if (row.candleIndex >= 0) return row.candleIndex;
    return 0;
  }

  private inferJourney(row: ReplaySignalIndexRow): string[] {
    const steps: string[] = [];
    const setup = (row.setup ?? '').toUpperCase();
    if (setup.includes('OPEN')) steps.push('OPEN READY');
    if (setup.includes('RECLAIM') || row.narrative?.toUpperCase().includes('RECLAIM')) {
      steps.push('VWAP RECLAIM');
    }
    if (row.narrative?.toUpperCase().includes('ACCEPT')) steps.push('ACCEPTANCE');
    if (setup.includes('SECOND')) steps.push('SECOND LEG');
    if (row.decision === 'EXIT' || row.decision === 'STOP') steps.push('EXIT TARGET');
    else steps.push((row.decision ?? 'SIGNAL').replace(/_/g, ' '));
    return steps;
  }
}
