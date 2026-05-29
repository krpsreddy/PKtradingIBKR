import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface HydrationControls {
  enabled: boolean;
  pendingJobs: number;
}

/** Phase 187 — toggle background historical hydration (research layer). */
@Injectable({ providedIn: 'root' })
export class BackgroundHydrationControlService {
  private readonly base = `${environment.apiUrl}/hydration`;
  private readonly stateSubject = new BehaviorSubject<HydrationControls>({
    enabled: true,
    pendingJobs: 0
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor(private http: HttpClient) {}

  load(): Observable<HydrationControls> {
    return this.http.get<HydrationControls>(`${this.base}/controls`).pipe(
      tap(c => this.stateSubject.next(c))
    );
  }

  setEnabled(enabled: boolean): Observable<HydrationControls> {
    return this.http.put<HydrationControls>(`${this.base}/controls`, { enabled }).pipe(
      tap(c => this.stateSubject.next(c))
    );
  }

  toggle(): void {
    const cur = this.stateSubject.value.enabled;
    this.setEnabled(!cur).subscribe();
  }

  statusLabel(): { text: string; tone: 'active' | 'paused' } {
    const s = this.stateSubject.value;
    if (s.enabled) {
      const q = s.pendingJobs > 0 ? ` (${s.pendingJobs})` : '';
      return { text: `HYDRATE ON${q}`, tone: 'active' };
    }
    return { text: 'HYDRATE OFF', tone: 'paused' };
  }
}
