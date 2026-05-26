import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Candle } from '../models/candle.model';

@Injectable({ providedIn: 'root' })
export class CandleService {
  constructor(private http: HttpClient) {}

  getLatest(symbol?: string): Observable<Candle[]> {
    const url = symbol
      ? `${environment.apiUrl}/candles/${symbol}`
      : `${environment.apiUrl}/candles/latest`;
    return this.http.get<Candle[]>(url);
  }
}
