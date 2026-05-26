import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ReplaySignalIndexPage } from './signal-centric-replay.models';

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

/** Phase 155 — compact signal index API (no full replay payloads). */
@Injectable({ providedIn: 'root' })
export class SignalReplayIndexService {
  private readonly base = `${environment.apiUrl}/replay-cache`;

  constructor(private http: HttpClient) {}

  async fetchIndex(params: SignalIndexQueryParams): Promise<ReplaySignalIndexPage | null> {
    const q = new URLSearchParams();
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 500));
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    if (params.decision && params.decision !== 'ALL') q.set('decision', params.decision);
    if (params.narrative && params.narrative !== 'ALL') q.set('narrative', params.narrative);
    if (params.quality && params.quality !== 'ALL') q.set('quality', params.quality);
    if (params.result && params.result !== 'ALL') q.set('result', params.result);

    return firstValueFrom(
      this.http.get<ReplaySignalIndexPage>(
        `${this.base}/signal-index/${params.symbol.toUpperCase()}?${q}`
      ).pipe(
        timeout(30_000),
        catchError(() => of(null))
      )
    );
  }
}
