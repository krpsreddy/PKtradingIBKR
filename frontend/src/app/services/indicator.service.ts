import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { IndicatorSnapshot } from '../models/indicator.model';

@Injectable({ providedIn: 'root' })
export class IndicatorService {
  constructor(private http: HttpClient) {}

  getLatest(symbol?: string): Observable<IndicatorSnapshot> {
    const url = symbol
      ? `${environment.apiUrl}/indicators/${symbol}`
      : `${environment.apiUrl}/indicators/latest`;
    return this.http.get<IndicatorSnapshot>(url);
  }
}
