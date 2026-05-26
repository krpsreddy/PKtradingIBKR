import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HotMomentumItem, OpeningMomentumItem, ReplayEventItem } from '../models/workspace.model';

@Injectable({ providedIn: 'root' })
export class MomentumService {
  constructor(private http: HttpClient) {}

  getHot(): Observable<HotMomentumItem[]> {
    return this.http.get<HotMomentumItem[]>(`${environment.apiUrl}/momentum/hot`);
  }

  getContinuation(): Observable<HotMomentumItem[]> {
    return this.http.get<HotMomentumItem[]>(`${environment.apiUrl}/momentum/continuation`);
  }

  getOpening(): Observable<OpeningMomentumItem[]> {
    return this.http.get<OpeningMomentumItem[]>(`${environment.apiUrl}/momentum/opening`);
  }

  getFailed(): Observable<HotMomentumItem[]> {
    return this.http.get<HotMomentumItem[]>(`${environment.apiUrl}/momentum/failed`);
  }

  getReplay(symbol: string): Observable<ReplayEventItem[]> {
    return this.http.get<ReplayEventItem[]>(`${environment.apiUrl}/replay/${symbol}`);
  }
}
