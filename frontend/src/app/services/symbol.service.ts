import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SymbolSubscribeResponse } from '../models/workspace.model';

@Injectable({ providedIn: 'root' })
export class SymbolService {
  constructor(private http: HttpClient) {}

  subscribe(symbol: string): Observable<SymbolSubscribeResponse> {
    return this.http.post<SymbolSubscribeResponse>(
      `${environment.apiUrl}/symbols/subscribe/${symbol}`,
      null
    );
  }
}
