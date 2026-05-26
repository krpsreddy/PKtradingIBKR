import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { catchError, of, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import {
  ANALYTICS_STORAGE_VERSION,
  AnalyticsVersionInfo,
  BulkUpsertResult,
  EvaluatedSnapshotPage,
  PersistedHydrationSession,
  StorageStats
} from './analytics-storage.models';
import { PlaybookCandidate } from '../playbook-discovery/playbook-candidate.models';

/** HTTP client for /api/analytics-storage (Phase 147). */
@Injectable({ providedIn: 'root' })
export class AnalyticsStorageApiService {
  private readonly base = `${environment.apiUrl}/analytics-storage`;

  constructor(private http: HttpClient) {}

  async fetchVersion(): Promise<AnalyticsVersionInfo | null> {
    return this.get<AnalyticsVersionInfo>(`${this.base}/version`);
  }

  async fetchStats(): Promise<StorageStats | null> {
    return this.get<StorageStats>(`${this.base}/stats`);
  }

  async fetchSnapshots(params: {
    symbol?: string;
    fromTs?: number;
    toTs?: number;
    page?: number;
    size?: number;
  } = {}): Promise<EvaluatedSnapshotPage | null> {
    const q = new URLSearchParams();
    if (params.symbol) q.set('symbol', params.symbol);
    if (params.fromTs != null) q.set('fromTs', String(params.fromTs));
    if (params.toTs != null) q.set('toTs', String(params.toTs));
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 500));
    return this.get<EvaluatedSnapshotPage>(`${this.base}/snapshots?${q}`);
  }

  async bulkUpsertSnapshots(signals: SignalSnapshot[]): Promise<BulkUpsertResult | null> {
    if (!signals.length) return { upserted: 0, skipped: 0, analyticsVersion: ANALYTICS_STORAGE_VERSION };
    return this.post<BulkUpsertResult>(`${this.base}/snapshots/bulk`, {
      signals,
      analyticsVersion: ANALYTICS_STORAGE_VERSION
    });
  }

  async fetchAllHydration(): Promise<PersistedHydrationSession[]> {
    return (await this.get<PersistedHydrationSession[]>(`${this.base}/hydration`)) ?? [];
  }

  async fetchHydration(symbol: string): Promise<PersistedHydrationSession | null> {
    return this.get<PersistedHydrationSession>(`${this.base}/hydration/${symbol.toUpperCase()}`);
  }

  async upsertHydration(session: PersistedHydrationSession): Promise<PersistedHydrationSession | null> {
    return this.put<PersistedHydrationSession>(`${this.base}/hydration/${session.symbol}`, session);
  }

  async fetchPlaybookCandidates(): Promise<PlaybookCandidate[]> {
    return (await this.get<PlaybookCandidate[]>(`${this.base}/playbook-candidates`)) ?? [];
  }

  async bulkUpsertPlaybooks(candidates: PlaybookCandidate[]): Promise<number> {
    const body = candidates.map(c => ({
      candidateId: c.id,
      candidateKey: c.name,
      payload: c,
      analyticsVersion: ANALYTICS_STORAGE_VERSION
    }));
    const res = await this.post<{ upserted: number }>(`${this.base}/playbook-candidates/bulk`, body);
    return res?.upserted ?? 0;
  }

  private get<T>(url: string): Promise<T | null> {
    return firstValueFrom(
      this.http.get<T>(url).pipe(
        timeout(30_000),
        catchError(() => of(null))
      )
    );
  }

  private post<T>(url: string, body: unknown): Promise<T | null> {
    return firstValueFrom(
      this.http.post<T>(url, body).pipe(
        timeout(60_000),
        catchError(() => of(null))
      )
    );
  }

  private put<T>(url: string, body: unknown): Promise<T | null> {
    return firstValueFrom(
      this.http.put<T>(url, body).pipe(
        timeout(30_000),
        catchError(() => of(null))
      )
    );
  }
}
