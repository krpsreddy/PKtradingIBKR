import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  BehaviorInsight,
  DEFAULT_PLAYBOOKS,
  MarketMemory,
  Playbook,
  ReplayCoaching,
  SessionReview,
  StatisticalConfidence,
  TraderEdge
} from '../models/analytics.model';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private base = `${environment.apiUrl}/analytics`;

  constructor(private http: HttpClient) {}

  getEdge(days = 60): Observable<TraderEdge> {
    return this.http.get<TraderEdge>(`${this.base}/edge?days=${days}`);
  }

  getBehavior(): Observable<BehaviorInsight[]> {
    return this.http.get<BehaviorInsight[]>(`${this.base}/behavior`);
  }

  getCoaching(symbol: string): Observable<ReplayCoaching> {
    return this.http.get<ReplayCoaching>(`${this.base}/coaching/${encodeURIComponent(symbol)}`);
  }

  getConfidence(signalType: string, regime: string): Observable<StatisticalConfidence[]> {
    return this.http.get<StatisticalConfidence[]>(
      `${this.base}/confidence?signalType=${encodeURIComponent(signalType)}&regime=${encodeURIComponent(regime)}`
    ).pipe(catchError(() => of([])));
  }

  getPlaybooks(): Observable<Playbook[]> {
    return this.http.get<Playbook[]>(`${this.base}/playbooks`).pipe(
      catchError(() => of(DEFAULT_PLAYBOOKS))
    );
  }

  getSessionReview(): Observable<SessionReview> {
    return this.http.get<SessionReview>(`${this.base}/session-review`).pipe(
      catchError(() => of({
        sessionDate: new Date().toISOString().slice(0, 10),
        topSetups: [],
        missedOpportunities: [],
        strongestSectors: [],
        failedSetups: [],
        regimeShifts: [],
        summary: 'Unable to load session review — is the backend running on :8080?'
      }))
    );
  }

  getMemory(): Observable<MarketMemory> {
    return this.http.get<MarketMemory>(`${this.base}/memory`);
  }
}
