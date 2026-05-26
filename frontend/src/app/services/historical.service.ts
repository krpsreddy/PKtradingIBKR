import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { HistoricalInsight, ReplayDates, SetupStatistics } from '../models/historical.model';

@Injectable({ providedIn: 'root' })
export class HistoricalService {
  private base = `${environment.apiUrl}/historical`;

  constructor(private http: HttpClient) {}

  getInsight(setupType: string, symbol?: string): Observable<HistoricalInsight | null> {
    const sym = symbol ? `&symbol=${encodeURIComponent(symbol)}` : '';
    return this.http.get<HistoricalInsight>(
      `${this.base}/insight?setupType=${encodeURIComponent(setupType)}${sym}`
    ).pipe(catchError(() => of(null)));
  }

  getSetupStats(setupType: string, days = 60): Observable<SetupStatistics | null> {
    return this.http.get<SetupStatistics>(
      `${this.base}/setup/${encodeURIComponent(setupType)}?days=${days}`
    ).pipe(catchError(() => of(null)));
  }

  getReplayDates(symbol: string): Observable<ReplayDates | null> {
    return this.http.get<ReplayDates>(
      `${this.base}/replay-dates/${encodeURIComponent(symbol)}`
    ).pipe(catchError(() => of(null)));
  }
}
