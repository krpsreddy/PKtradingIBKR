import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MarketTrend } from '../models/workspace.model';

@Injectable({ providedIn: 'root' })
export class MarketTrendService {
  constructor(private http: HttpClient) {}

  getTrend(): Observable<MarketTrend> {
    return this.http.get<MarketTrend>(`${environment.apiUrl}/market/trend`);
  }
}
