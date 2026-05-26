import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import {
  EMPTY_PROBABILISTIC_SNAPSHOT,
  ProbabilisticExecutionSnapshot,
  ReplayProbabilistic
} from '../models/probabilistic.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProbabilisticService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getSnapshot(symbol: string, signalType?: string | null): Observable<ProbabilisticExecutionSnapshot> {
    const params: Record<string, string> = {};
    if (symbol) params['symbol'] = symbol;
    if (signalType) params['signalType'] = signalType;
    return this.http.get<ProbabilisticExecutionSnapshot>(`${this.base}/probabilistic/snapshot`, { params })
      .pipe(catchError(() => of(EMPTY_PROBABILISTIC_SNAPSHOT)));
  }

  getReplay(symbol: string, index: number, signalType?: string | null): Observable<ReplayProbabilistic | null> {
    const params: Record<string, string> = { index: String(index) };
    if (signalType) params['signalType'] = signalType;
    return this.http.get<ReplayProbabilistic>(`${this.base}/probabilistic/replay/${symbol}`, { params })
      .pipe(catchError(() => of(null)));
  }
}
