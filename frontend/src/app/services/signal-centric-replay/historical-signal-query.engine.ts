import { Injectable } from '@angular/core';
import { SignalCentricFilters } from './signal-centric-replay.models';

export interface SignalIndexQueryParams {
  symbol: string;
  from?: string;
  to?: string;
  decision?: string;
  narrative?: string;
  quality?: string;
  result?: string;
  page?: number;
  size?: number;
}

/** Builds API query params from explorer filters. */
@Injectable({ providedIn: 'root' })
export class HistoricalSignalQueryEngine {
  buildQuery(symbol: string, filters: SignalCentricFilters): SignalIndexQueryParams {
    const from = this.windowFromIso(filters.timeWindowDays);
    return {
      symbol: symbol.toUpperCase(),
      from,
      decision: filters.decision !== 'ALL' ? filters.decision : undefined,
      narrative: filters.narrative !== 'ALL' ? filters.narrative : undefined,
      quality: filters.quality !== 'ALL' ? filters.quality : undefined,
      result: filters.result !== 'ALL' ? filters.result : undefined,
      size: 500
    };
  }

  windowFromIso(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }
}
