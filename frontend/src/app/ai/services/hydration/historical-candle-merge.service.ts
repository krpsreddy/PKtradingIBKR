import { Injectable } from '@angular/core';
import { SymbolHistoryCoverage } from './symbol-history-hydration.models';

/** Tracks candle coverage merge metadata — backend dedupes DB writes; this tracks hydration state. */
@Injectable({ providedIn: 'root' })
export class HistoricalCandleMergeService {

  /** Merge coverage snapshot into hydration counters — no in-memory candle arrays. */
  applyCoverage(
    priorCandles: number,
    coverage: SymbolHistoryCoverage
  ): {
    totalCandlesLoaded: number;
    earliestLoadedTimestamp: number | null;
    latestLoadedTimestamp: number | null;
    loadedDays: number;
  } {
    const earliest = coverage.earliestTimestamp
      ? new Date(coverage.earliestTimestamp).getTime()
      : null;
    const latest = coverage.latestTimestamp
      ? new Date(coverage.latestTimestamp).getTime()
      : null;

    return {
      totalCandlesLoaded: Math.max(priorCandles, coverage.totalCandles),
      earliestLoadedTimestamp: earliest,
      latestLoadedTimestamp: latest,
      loadedDays: coverage.loadedSessionDays
    };
  }

  /** Sessions needing replay — dates in coverage not yet evaluated. */
  filterUnevaluatedSessions(
    sessionDates: string[],
    evaluatedSessionDates: string[]
  ): string[] {
    const done = new Set(evaluatedSessionDates);
    return sessionDates.filter(d => !done.has(d));
  }
}
