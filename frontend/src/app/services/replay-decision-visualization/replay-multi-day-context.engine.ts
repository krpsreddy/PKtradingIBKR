import { Injectable } from '@angular/core';
import { ReplayHistory } from '../../models/replay.model';
import { Candle } from '../../models/candle.model';
import { ReplayContextMode } from './replay-decision-visualization.models';
import { ReplaySessionCatalogEntry } from '../replay-workstation/replay-workstation.models';

@Injectable({ providedIn: 'root' })
export class ReplayMultiDayContextEngine {
  priorSessionCount(mode: ReplayContextMode): number {
    switch (mode) {
      case 'INTRADAY_ONLY': return 0;
      case 'PREVIOUS_DAY': return 1;
      case 'THREE_DAY_CONTEXT': return 3;
      case 'WEEK_CONTEXT': return 5;
    }
  }

  priorSessionDates(
    sessionDate: string,
    sessions: ReplaySessionCatalogEntry[],
    mode: ReplayContextMode
  ): string[] {
    const count = this.priorSessionCount(mode);
    if (count <= 0) return [];
    const sorted = sessions
      .filter(s => s.sessionDate < sessionDate)
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
    return sorted.slice(-count).map(s => s.sessionDate);
  }

  mergeContextCandles(
    priorSessions: ReplayHistory[],
    current: ReplayHistory
  ): { candles: Candle[]; sessionStartIndex: number } {
    const priorCandles = priorSessions.flatMap(s => s.sessionCandles);
    return {
      candles: [...priorCandles, ...current.sessionCandles],
      sessionStartIndex: priorCandles.length
    };
  }

  dimPriorDayOpacity(barIndex: number, sessionStartIndex: number): number {
    if (sessionStartIndex <= 0 || barIndex >= sessionStartIndex) return 1;
    return 0.55;
  }
}
