import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  HistoricalSignalRecord,
  HistoricalSignalSearchPage
} from './signal-explorer.models';

@Injectable({ providedIn: 'root' })
export class SignalExplorerApiService {
  private readonly base = `${environment.apiUrl}/analytics-storage`;

  constructor(private http: HttpClient) {}

  async searchSignals(params: {
    symbol?: string;
    from?: string;
    to?: string;
    decision?: string;
    narrative?: string;
    quality?: string;
    result?: string;
    page?: number;
    size?: number;
  }): Promise<HistoricalSignalSearchPage | null> {
    const q = new URLSearchParams();
    if (params.symbol) q.set('symbol', params.symbol.toUpperCase());
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.decision && params.decision !== 'ALL') q.set('decision', params.decision);
    if (params.narrative && params.narrative !== 'ALL') q.set('narrative', params.narrative);
    if (params.quality && params.quality !== 'ALL') q.set('quality', params.quality);
    if (params.result && params.result !== 'ALL') q.set('result', params.result);
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 500));
    return firstValueFrom(
      this.http.get<HistoricalSignalSearchPage>(`${this.base}/signals/search?${q}`).pipe(
        timeout(30_000),
        catchError(() => of(null))
      )
    );
  }
}

export type { HistoricalSignalRecord };
