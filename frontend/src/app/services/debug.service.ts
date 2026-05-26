import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DebugPanel } from '../models/system-status.model';

@Injectable({ providedIn: 'root' })
export class DebugService {
  constructor(private http: HttpClient) {}

  getPanel(): Observable<DebugPanel> {
    return this.http.get<DebugPanel>(`${environment.apiUrl}/debug/panel`);
  }

  getOpenMomentumDebug(symbol: string): Observable<unknown> {
    return this.http.get(`${environment.apiUrl}/debug/open-mom/${symbol}`);
  }
}
