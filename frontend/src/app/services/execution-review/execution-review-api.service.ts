import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ContinuationCapture,
  DailySummary,
  QueueAnalysis,
  RegimePerformance,
  ReviewFilters,
  SessionAnalysis,
  TradesResponse
} from './execution-review.models';

@Injectable({ providedIn: 'root' })
export class ExecutionReviewApiService {
  private readonly base = `${environment.apiUrl}/execution-review`;

  constructor(private http: HttpClient) {}

  dailySummary(date?: string): Observable<DailySummary> {
    return this.http.get<DailySummary>(`${this.base}/daily-summary`, { params: this.dateParams(date) });
  }

  trades(filters: Partial<ReviewFilters>): Observable<TradesResponse> {
    let params = this.dateParams(filters.date);
    if (filters.regime) params = params.set('regime', filters.regime);
    if (filters.lifecycle) params = params.set('lifecycle', filters.lifecycle);
    if (filters.outcome) params = params.set('outcome', filters.outcome);
    if (filters.symbol) params = params.set('symbol', filters.symbol);
    if (filters.sessionPeriod) params = params.set('sessionPeriod', filters.sessionPeriod);
    if (filters.entryQuality) params = params.set('entryQuality', filters.entryQuality);
    if (filters.exitQuality) params = params.set('exitQuality', filters.exitQuality);
    return this.http.get<TradesResponse>(`${this.base}/trades`, { params });
  }

  regimePerformance(date?: string): Observable<RegimePerformance[]> {
    return this.http.get<RegimePerformance[]>(`${this.base}/regime-performance`, {
      params: this.dateParams(date)
    });
  }

  continuationCapture(date?: string): Observable<ContinuationCapture[]> {
    return this.http.get<ContinuationCapture[]>(`${this.base}/continuation-capture`, {
      params: this.dateParams(date)
    });
  }

  queueAnalysis(date?: string): Observable<QueueAnalysis> {
    return this.http.get<QueueAnalysis>(`${this.base}/queue-analysis`, { params: this.dateParams(date) });
  }

  sessionAnalysis(date?: string): Observable<SessionAnalysis[]> {
    return this.http.get<SessionAnalysis[]>(`${this.base}/session-analysis`, {
      params: this.dateParams(date)
    });
  }

  private dateParams(date?: string): HttpParams {
    let p = new HttpParams();
    if (date) p = p.set('date', date);
    return p;
  }
}
