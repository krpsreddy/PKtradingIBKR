import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { INTELLIGENCE_OFFLOAD } from './intelligence-offload.config';
import {
  ExecutionCardsSnapshotDto,
  IntelligenceSnapshotApiService,
  LiveRegimeSnapshotDto,
  ReplayMarkerDto,
  ReplayTimelineSnapshotDto
} from './intelligence-snapshot-api.service';

/** Phase 164 — orchestrates backend snapshots; disables frontend hot loops. */
@Injectable({ providedIn: 'root' })
export class IntelligenceOffloadService {
  private readonly timelineCache = new Map<string, ReplayTimelineSnapshotDto>();
  private readonly liveRegimeCache = new Map<string, { at: number; data: LiveRegimeSnapshotDto }>();
  private readonly cardsCache = new Map<string, { at: number; data: ExecutionCardsSnapshotDto }>();

  private readonly readySubject = new BehaviorSubject<boolean>(INTELLIGENCE_OFFLOAD.enabled);
  readonly ready$ = this.readySubject.asObservable();

  constructor(private api: IntelligenceSnapshotApiService) {}

  isEnabled(): boolean {
    return INTELLIGENCE_OFFLOAD.enabled;
  }

  skipFrontendSynthesis(): boolean {
    return INTELLIGENCE_OFFLOAD.enabled && INTELLIGENCE_OFFLOAD.skipFrontendSynthesis;
  }

  /** Subscribe to store revision only when frontend synthesis is allowed. */
  bindRevisionRefresh(refresh: () => void, storeRevision$: Observable<number>): void {
    if (this.skipFrontendSynthesis()) return;
    storeRevision$.subscribe(() => refresh());
  }

  fetchLiveRegime(symbol: string, lookbackDays?: number): Observable<LiveRegimeSnapshotDto> {
    const sym = symbol.toUpperCase();
    const cached = this.liveRegimeCache.get(sym);
    if (cached && Date.now() - cached.at < INTELLIGENCE_OFFLOAD.liveCacheTtlMs) {
      return of(cached.data);
    }
    return this.api.liveRegime(sym, lookbackDays).pipe(
      tap(data => this.liveRegimeCache.set(sym, { at: Date.now(), data })),
      catchError(() => of(this.emptyLiveRegime(sym)))
    );
  }

  fetchExecutionCards(symbol: string, lookbackDays?: number): Observable<ExecutionCardsSnapshotDto> {
    const sym = symbol.toUpperCase();
    const cached = this.cardsCache.get(sym);
    if (cached && Date.now() - cached.at < INTELLIGENCE_OFFLOAD.liveCacheTtlMs) {
      return of(cached.data);
    }
    return this.api.executionCards(sym, lookbackDays).pipe(
      tap(data => this.cardsCache.set(sym, { at: Date.now(), data })),
      catchError(() => of({ advisoryOnly: true, generatedAt: Date.now(), analyticsVersion: 0, symbol: sym, cards: [], summaryInsights: [] }))
    );
  }

  loadReplayTimeline(symbol: string, session: string): Observable<ReplayTimelineSnapshotDto> {
    const key = `${symbol.toUpperCase()}:${session}`;
    const hit = this.timelineCache.get(key);
    if (hit) return of(hit);
    return this.api.replayTimeline(symbol, session).pipe(
      tap(data => this.timelineCache.set(key, data)),
      catchError(() => of(this.emptyTimeline(symbol, session))),
      shareReplay(1)
    );
  }

  getCachedMarkers(symbol: string, session: string): ReplayMarkerDto[] | null {
    const key = `${symbol.toUpperCase()}:${session}`;
    return this.timelineCache.get(key)?.replayMarkers ?? null;
  }

  prefetchForSymbol(symbol: string, lookbackDays?: number): void {
    const sym = symbol.toUpperCase();
    this.fetchLiveRegime(sym, lookbackDays).subscribe();
    this.fetchExecutionCards(sym, lookbackDays).subscribe();
  }

  invalidateSymbol(symbol: string): void {
    const sym = symbol.toUpperCase();
    this.liveRegimeCache.delete(sym);
    this.cardsCache.delete(sym);
    for (const key of [...this.timelineCache.keys()]) {
      if (key.startsWith(sym + ':')) this.timelineCache.delete(key);
    }
  }

  private emptyLiveRegime(symbol: string): LiveRegimeSnapshotDto {
    return {
      advisoryOnly: true,
      lookbackDays: 60,
      generatedAt: Date.now(),
      analyticsVersion: 0,
      sampleCount: 0,
      activeContinuationRegimes: [],
      participationOpportunities: [],
      summaryInsights: ['Backend snapshot unavailable — hydrate evaluated history']
    };
  }

  private emptyTimeline(symbol: string, session: string): ReplayTimelineSnapshotDto {
    return {
      advisoryOnly: true,
      generatedAt: Date.now(),
      analyticsVersion: 0,
      symbol: symbol.toUpperCase(),
      sessionDate: session,
      bars: [],
      replayMarkers: [],
      timelineEvents: [],
      visualizationPayload: { triggerCount: 0, addOpportunityCount: 0, exhaustionCount: 0, dominantRegime: '' }
    };
  }
}
