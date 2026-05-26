import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  AnalyticsQueryFilters,
  AnalyticsWorkbench,
  ConvictionDistribution,
  CrossMatrix,
  DiagnosticsSummary,
  GroupStat
} from './analytics-query.models';

@Injectable({ providedIn: 'root' })
export class AnalyticsQueryApiService {
  private readonly base = `${environment.apiUrl}/analytics-query`;

  constructor(private http: HttpClient) {}

  async fetchWorkbench(filters: AnalyticsQueryFilters = {}): Promise<AnalyticsWorkbench | null> {
    return this.get<AnalyticsWorkbench>(`${this.base}/workbench`, filters);
  }

  async fetchConvictionDistribution(filters: AnalyticsQueryFilters = {}): Promise<ConvictionDistribution | null> {
    return this.get<ConvictionDistribution>(`${this.base}/conviction-distribution`, filters);
  }

  async fetchDecisionStats(filters: AnalyticsQueryFilters = {}): Promise<GroupStat[] | null> {
    return this.get<GroupStat[]>(`${this.base}/decision-stats`, filters);
  }

  async fetchNarrativeStats(filters: AnalyticsQueryFilters = {}): Promise<GroupStat[] | null> {
    return this.get<GroupStat[]>(`${this.base}/narrative-stats`, filters);
  }

  async fetchCrossMatrix(filters: AnalyticsQueryFilters = {}): Promise<CrossMatrix | null> {
    return this.get<CrossMatrix>(`${this.base}/cross-matrix`, filters);
  }

  async fetchDiagnostics(filters: AnalyticsQueryFilters = {}): Promise<DiagnosticsSummary | null> {
    return this.get<DiagnosticsSummary>(`${this.base}/diagnostics`, filters);
  }

  async fetchDbCount(): Promise<number> {
    const res = await firstValueFrom(
      this.http.get<{ evaluatedSnapshots: number }>(`${this.base}/db-count`).pipe(
        timeout(10_000),
        catchError(() => of({ evaluatedSnapshots: 0 }))
      )
    );
    return res.evaluatedSnapshots ?? 0;
  }

  private async get<T>(url: string, filters: AnalyticsQueryFilters): Promise<T | null> {
    const q = new URLSearchParams();
    if (filters.symbol) q.set('symbol', filters.symbol.toUpperCase());
    if (filters.from) q.set('from', filters.from);
    if (filters.to) q.set('to', filters.to);
    if (filters.decision && filters.decision !== 'ALL') q.set('decision', filters.decision);
    if (filters.narrative && filters.narrative !== 'ALL') q.set('narrative', filters.narrative);
    if (filters.quality && filters.quality !== 'ALL') q.set('quality', filters.quality);
    if (filters.result && filters.result !== 'ALL') q.set('result', filters.result);
    if (filters.convictionBand && filters.convictionBand !== 'ALL') q.set('convictionBand', filters.convictionBand);

    const suffix = q.toString() ? `?${q}` : '';
    return firstValueFrom(
      this.http.get<T>(`${url}${suffix}`).pipe(
        timeout(30_000),
        catchError(() => of(null))
      )
    );
  }
}
