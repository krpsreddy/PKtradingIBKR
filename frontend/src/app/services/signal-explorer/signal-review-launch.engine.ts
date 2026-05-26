import { Injectable } from '@angular/core';
import { HistoricalSignalRecord, SignalReplayLaunchPlan } from './signal-explorer.models';

@Injectable({ providedIn: 'root' })
export class SignalReviewLaunchEngine {
  buildLaunchPlan(record: HistoricalSignalRecord): SignalReplayLaunchPlan {
    return {
      signalId: record.signalId,
      symbol: record.symbol.toUpperCase(),
      sessionDate: record.sessionDate,
      replayIndex: Math.max(0, record.replayIndex),
      openReviewMode: true,
      centerViewport: true,
      pauseReplay: true
    };
  }

  canLaunch(record: HistoricalSignalRecord): boolean {
    return !!record.sessionDate && record.replayIndex >= 0;
  }

  /** Fallback bar index when backend did not enrich — caller resolves from replay history. */
  needsBarResolution(record: HistoricalSignalRecord): boolean {
    return record.replayIndex < 0 && !!record.sessionDate;
  }
}
