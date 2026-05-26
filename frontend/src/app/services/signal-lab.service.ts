import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HotMomentumItem, OpeningMomentumItem, ReplayEventItem } from '../models/workspace.model';
import { SignalHealth, OpenMomDebug, OpenScoutDebug, OpenFailDebug, MomPullDebug } from '../models/signal-lab.model';
import { SystemStatus } from '../models/system-status.model';
import { TradingSignal } from '../models/signal.model';

@Injectable({ providedIn: 'root' })
export class SignalLabService {
  readonly apiBase = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getHealth(): Observable<SignalHealth> {
    return this.http.get<SignalHealth>(`${this.apiBase}/health/signals`);
  }

  getStatus(): Observable<SystemStatus> {
    return this.http.get<SystemStatus>(`${this.apiBase}/system/status`);
  }

  getOpenMomDebug(symbol: string): Observable<OpenMomDebug> {
    return this.http.get<OpenMomDebug>(`${this.apiBase}/debug/open-mom/${symbol}`);
  }

  getOpenScoutDebug(symbol: string): Observable<OpenScoutDebug> {
    return this.http.get<OpenScoutDebug>(`${this.apiBase}/debug/open-scout/${symbol}`);
  }

  getOpenFailDebug(symbol: string): Observable<OpenFailDebug> {
    return this.http.get<OpenFailDebug>(`${this.apiBase}/debug/open-fail/${symbol}`);
  }

  getMomPullDebug(symbol: string): Observable<MomPullDebug> {
    return this.http.get<MomPullDebug>(`${this.apiBase}/debug/mom-pull/${symbol}`);
  }

  getReplay(symbol: string): Observable<ReplayEventItem[]> {
    return this.http.get<ReplayEventItem[]>(`${this.apiBase}/replay/${symbol}`);
  }

  getSignals(symbol: string): Observable<TradingSignal[]> {
    return this.http.get<TradingSignal[]>(`${this.apiBase}/signals/${symbol}`);
  }

  getHotMomentum(): Observable<HotMomentumItem[]> {
    return this.http.get<HotMomentumItem[]>(`${this.apiBase}/momentum/hot`);
  }

  getOpeningMomentum(): Observable<OpeningMomentumItem[]> {
    return this.http.get<OpeningMomentumItem[]>(`${this.apiBase}/momentum/opening`);
  }

  getFailedMomentum(): Observable<HotMomentumItem[]> {
    return this.http.get<HotMomentumItem[]>(`${this.apiBase}/momentum/failed`);
  }

  getContinuation(): Observable<HotMomentumItem[]> {
    return this.http.get<HotMomentumItem[]>(`${this.apiBase}/momentum/continuation`);
  }

  apiUrl(path: string): string {
    return `${this.apiBase}${path}`;
  }
}
