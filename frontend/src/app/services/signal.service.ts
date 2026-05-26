import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TradingSignal } from '../models/signal.model';
import { ActiveSignal } from '../models/workspace.model';

@Injectable({ providedIn: 'root' })
export class SignalService {
  constructor(private http: HttpClient) {}

  getLatest(symbol?: string): Observable<TradingSignal[]> {
    const url = symbol
      ? `${environment.apiUrl}/signals/${symbol}`
      : `${environment.apiUrl}/signals/latest`;
    return this.http.get<TradingSignal[]>(url);
  }

  getActive(): Observable<ActiveSignal[]> {
    return this.http.get<ActiveSignal[]>(`${environment.apiUrl}/signals/active`);
  }
}
