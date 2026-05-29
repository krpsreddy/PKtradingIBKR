import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BrokerConnectionStatus, BrokerEventPayload, BrokerProfile } from './broker.models';

@Injectable({ providedIn: 'root' })
export class BrokerConnectionService {
  private readonly base = `${environment.apiUrl}/broker`;
  private readonly statusSubject = new BehaviorSubject<BrokerConnectionStatus | null>(null);
  private readonly profilesSubject = new BehaviorSubject<BrokerProfile[]>([]);
  private eventSource: EventSource | null = null;

  readonly status$ = this.statusSubject.asObservable();
  readonly profiles$ = this.profilesSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadProfiles(): Observable<BrokerProfile[]> {
    return this.http.get<BrokerProfile[]>(`${this.base}/profiles`).pipe(
      tap(p => this.profilesSubject.next(p))
    );
  }

  refreshStatus(): Observable<BrokerConnectionStatus> {
    return this.http.get<BrokerConnectionStatus>(`${this.base}/status`).pipe(
      tap(s => this.statusSubject.next(s))
    );
  }

  connect(profileId: string): Observable<{ ok: boolean; status: BrokerConnectionStatus }> {
    return this.http.post<{ ok: boolean; status: BrokerConnectionStatus }>(
      `${this.base}/connect/${encodeURIComponent(profileId)}`,
      {}
    ).pipe(tap(r => this.statusSubject.next(r.status)));
  }

  disconnect(): Observable<BrokerConnectionStatus> {
    return this.http.post<BrokerConnectionStatus>(`${this.base}/disconnect`, {}).pipe(
      tap(s => this.statusSubject.next(s))
    );
  }

  reconnect(): Observable<{ ok: boolean; status: BrokerConnectionStatus }> {
    return this.http.post<{ ok: boolean; status: BrokerConnectionStatus }>(
      `${this.base}/reconnect`,
      {}
    ).pipe(tap(r => this.statusSubject.next(r.status)));
  }

  startEventStream(): void {
    this.stopEventStream();
    const url = `${environment.apiUrl.replace(/\/api$/, '')}/api/broker/events/stream`;
    this.eventSource = new EventSource(url);
    this.eventSource.addEventListener('broker', (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data) as BrokerEventPayload;
        if (payload?.status) {
          this.statusSubject.next(payload.status);
        }
      } catch {
        /* ignore malformed */
      }
    });
    this.eventSource.onerror = () => {
      this.stopEventStream();
      setTimeout(() => this.startEventStream(), 5000);
    };
  }

  stopEventStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
