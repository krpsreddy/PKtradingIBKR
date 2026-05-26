import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { timeout, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { BulkReplayHistory } from '../../../models/replay.model';
import {
  IncrementalReplayResponse,
  StaleSessionsResponse,
  SymbolSnapshotPage
} from './replay-cache.models';

/** Phase 149 — backend replay cache API client. */
@Injectable({ providedIn: 'root' })
export class ReplayCacheApiService {
  private readonly base = `${environment.apiUrl}/replay-cache`;

  constructor(private http: HttpClient) {}

  fetchSessionSummaries(symbol: string, days = 60): Promise<import('./replay-cache.models').ReplaySessionSummaryApi[] | null> {
    return firstValueFrom(
      this.http.get<import('./replay-cache.models').ReplaySessionSummaryApi[]>(
        `${this.base}/session-summary/${symbol.toUpperCase()}`,
        { params: { days: String(days) } }
      ).pipe(
        timeout(15_000),
        catchError(() => of(null))
      )
    );
  }

  fetchSessionSnapshot(symbol: string, sessionDate: string): Promise<import('../../../models/replay.model').ReplayHistory | null> {
    return firstValueFrom(
      this.http.get<import('../../../models/replay.model').ReplayHistory>(
        `${this.base}/snapshot/${symbol.toUpperCase()}/${sessionDate}`
      ).pipe(
        timeout(15_000),
        catchError(() => of(null))
      )
    );
  }

  fetchSnapshotSummary(symbol: string, days = 60): Promise<SymbolSnapshotPage | null> {
    return firstValueFrom(
      this.http.get<SymbolSnapshotPage>(`${this.base}/snapshot/${symbol.toUpperCase()}`, {
        params: { days: String(days) }
      }).pipe(
        timeout(15_000),
        catchError(() => of(null))
      )
    );
  }

  fetchStaleSessions(symbol: string, days = 60): Promise<StaleSessionsResponse | null> {
    return firstValueFrom(
      this.http.get<StaleSessionsResponse>(`${this.base}/stale-sessions/${symbol.toUpperCase()}`, {
        params: { days: String(days) }
      }).pipe(
        timeout(15_000),
        catchError(() => of(null))
      )
    );
  }

  incrementalReplay(symbol: string, days = 60, force = false): Promise<IncrementalReplayResponse | null> {
    return firstValueFrom(
      this.http.post<IncrementalReplayResponse>(
        `${this.base}/incremental-replay/${symbol.toUpperCase()}`,
        null,
        { params: { days: String(days), force: String(force) } }
      ).pipe(
        timeout(180_000),
        catchError(() => of(null))
      )
    );
  }

  /** Map incremental API response to existing BulkReplayHistory shape. */
  toBulkHistory(result: IncrementalReplayResponse): BulkReplayHistory {
    return {
      symbol: result.symbol,
      lookbackDays: result.lookbackDays,
      sessionsProcessed: result.sessionsProcessed,
      sessionsWithSignals: result.sessionsWithSignals,
      totalSignals: result.totalSignals,
      candlesStored: result.candlesStored,
      historyStatus: result.historyStatus,
      historyMessage: result.historyMessage,
      sessions: result.sessions ?? []
    };
  }
}
