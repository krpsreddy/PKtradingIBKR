import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { CognitionSnapshot, EMPTY_COGNITION, ReplayNarrative } from '../models/cognition.model';

@Injectable({ providedIn: 'root' })
export class CognitionService {
  private base = `${environment.apiUrl}/cognition`;
  private cache = new Map<string, { ts: number; data: CognitionSnapshot }>();
  private readonly TTL_MS = 8_000;

  private snapshot$ = new BehaviorSubject<CognitionSnapshot>(EMPTY_COGNITION);
  readonly cognition$ = this.snapshot$.asObservable();

  constructor(private http: HttpClient) {}

  getSnapshot(symbol?: string): Observable<CognitionSnapshot> {
    const key = (symbol ?? '').toUpperCase();
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.ts < this.TTL_MS) {
      this.snapshot$.next(cached.data);
      return of(cached.data);
    }
    const params = key ? `?symbol=${encodeURIComponent(key)}` : '';
    return this.http.get<CognitionSnapshot>(`${this.base}/snapshot${params}`).pipe(
      tap(data => {
        this.cache.set(key, { ts: Date.now(), data });
        this.snapshot$.next(data);
      }),
      catchError(() => {
        const empty = { ...EMPTY_COGNITION, timestamp: Date.now() };
        this.snapshot$.next(empty);
        return of(empty);
      }),
      shareReplay(1)
    );
  }

  getReplayNarrative(symbol: string, index: number): Observable<ReplayNarrative> {
    return this.http.get<ReplayNarrative>(
      `${this.base}/replay/${encodeURIComponent(symbol)}?index=${index}`
    ).pipe(catchError(() => of({
      symbol,
      narrative: 'Replay narrative unavailable.',
      improvements: [],
      deteriorations: [],
      idealEntries: []
    })));
  }

  invalidate(symbol?: string): void {
    if (symbol) this.cache.delete(symbol.toUpperCase());
    else this.cache.clear();
  }

  current(): CognitionSnapshot {
    return this.snapshot$.value;
  }
}
