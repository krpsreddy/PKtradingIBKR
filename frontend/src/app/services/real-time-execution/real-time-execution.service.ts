import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ExecutionFeedItem,
  ExecutionFeedSnapshot,
  ExecutionFrameworkMode167,
  StrategyDefinition
} from './real-time-execution.models';
import { visibleEnrichedFeed } from '../execution-intelligence/opportunity-enrichment.engine';
import { EnrichedOpportunity } from '../execution-intelligence/enriched-opportunity.model';
import { TraderOperatingModeService } from '../trader-operating-mode.service';
import { HttpRequestManagerService } from '../network/http-request-manager.service';
import { DashboardStateStoreService } from '../dashboard/dashboard-state-store.service';
import { NetworkDiagnosticsService } from '../network/network-diagnostics.service';
import { applyNanoBoost, NanoScanResult } from './nano-scanner.engine';

const FEED_POLL_MS = environment.feedPollMs ?? 2_000;
const SSE_RETRY_MS = 5_000;

/** Phase 167/169 — execution feed via SSE with deduped poll fallback. */
@Injectable({ providedIn: 'root' })
export class RealTimeExecutionService implements OnDestroy {
  private readonly base = environment.apiUrl.replace(/\/api$/, '');
  private readonly feedSubject = new BehaviorSubject<ExecutionFeedSnapshot | null>(null);
  private readonly enrichedSubject = new BehaviorSubject<EnrichedOpportunity[]>([]);
  private readonly strategiesSubject = new BehaviorSubject<StrategyDefinition[]>([]);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private eventSource: EventSource | null = null;
  private pollInFlight = false;
  private connected = false;
  private lastGeneration = -1;
  readonly feed$ = this.feedSubject.asObservable();
  readonly enriched$ = this.enrichedSubject.asObservable();
  readonly strategies$ = this.strategiesSubject.asObservable();

  executionMode: ExecutionFrameworkMode167 = 'CONFIRMED';

  constructor(
    private http: HttpClient,
    private traderMode: TraderOperatingModeService,
    private requestManager: HttpRequestManagerService,
    private store: DashboardStateStoreService,
    private diagnostics: NetworkDiagnosticsService,
    private zone: NgZone
  ) {}

  snapshot(): ExecutionFeedSnapshot | null {
    return this.feedSubject.value;
  }

  enrichedFeed(): EnrichedOpportunity[] {
    return this.enrichedSubject.value;
  }

  topEnriched(): EnrichedOpportunity | null {
    return this.enrichedSubject.value[0] ?? null;
  }

  topFeed(limit = 12): ExecutionFeedItem[] {
    const snap = this.feedSubject.value;
    if (!snap) return [];
    return this.enrichedSubject.value.slice(0, limit).map(e => {
      const raw = snap.feed.find(f => f.symbol === e.symbol);
      return raw!;
    }).filter(Boolean);
  }

  itemForSymbol(symbol: string): ExecutionFeedItem | null {
    const sym = symbol.toUpperCase();
    return this.feedSubject.value?.feed.find(i => i.symbol === sym) ?? null;
  }

  enrichedForSymbol(symbol: string): EnrichedOpportunity | null {
    const sym = symbol.toUpperCase();
    return this.enrichedSubject.value.find(i => i.symbol === sym) ?? null;
  }

  /** @deprecated Use connect() via DashboardOrchestrator. */
  startPolling(): void {
    this.connect();
  }

  /** @deprecated Use disconnect() via DashboardOrchestrator. */
  stopPolling(): void {
    this.disconnect();
  }

  connect(): void {
    if (this.connected) return;
    this.connected = true;
    this.openSse();
  }

  disconnect(): void {
    this.connected = false;
    this.closeSse();
    this.stopPollFallback();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  refreshFeed(): Observable<ExecutionFeedSnapshot> {
    return this.requestManager.get(
      'execution:feed',
      () =>
        this.http.get<ExecutionFeedSnapshot>(`${this.base}/api/execution/feed`).pipe(
          tap(snap => this.applySnapshot(snap))
        ),
      { cacheKey: 'execution:feed', cacheBucket: 'executionFeed', cancelPrevious: true, timeoutMs: 8_000 }
    );
  }

  loadStrategies(): Observable<StrategyDefinition[]> {
    return this.http.get<StrategyDefinition[]>(`${this.base}/api/strategy-memory`).pipe(
      tap(list => this.strategiesSubject.next(list)),
      catchError(() => {
        this.strategiesSubject.next([]);
        return of([]);
      })
    );
  }

  setStrategyActive(strategyId: string, active: boolean): Observable<{ strategyId: string; active: boolean }> {
    return this.http.patch<{ strategyId: string; active: boolean }>(
      `${this.base}/api/strategy-memory/${strategyId}/active`,
      { active }
    ).pipe(tap(() => this.loadStrategies().subscribe()));
  }

  updateStrategyThresholds(
    strategyId: string,
    thresholds: Record<string, number>,
    notes?: string
  ): Observable<StrategyDefinition> {
    return this.http.patch<StrategyDefinition>(
      `${this.base}/api/strategy-memory/${strategyId}/thresholds`,
      { thresholds, notes }
    ).pipe(tap(() => this.loadStrategies().subscribe()));
  }

  setExecutionMode(mode: ExecutionFrameworkMode167): void {
    this.executionMode = mode;
    const snap = this.feedSubject.value;
    if (snap) this.recomputeEnriched(snap.feed);
  }

  visibleFeed(mode = this.executionMode): ExecutionFeedItem[] {
    return this.enrichedSubject.value
      .slice(0, 24)
      .map(e => this.feedSubject.value?.feed.find(f => f.symbol === e.symbol))
      .filter((f): f is ExecutionFeedItem => !!f);
  }

  /** Phase 178 — tier-1 reprioritize feed without HTTP or plan rebuild. */
  applyNanoPrioritization(boosts: Map<string, NanoScanResult>): void {
    const snap = this.feedSubject.value;
    if (!snap?.feed.length) return;
    const boosted = applyNanoBoost(snap.feed, boosts);
    this.recomputeEnriched(boosted);
  }

  visibleEnriched(mode = this.executionMode): EnrichedOpportunity[] {
    const snap = this.feedSubject.value;
    if (!snap) return [];
    return visibleEnrichedFeed(
      snap.feed,
      this.traderMode.isExecution() ? 'EXECUTION' : 'RESEARCH',
      mode
    );
  }

  private openSse(): void {
    this.closeSse();
    const url = `${this.base}/api/execution/feed/stream`;
    try {
      this.eventSource = new EventSource(url);
      this.diagnostics.setFeedTransport('sse');
      this.eventSource.onmessage = ev => {
        this.zone.run(() => {
          try {
            const snap = JSON.parse(ev.data) as ExecutionFeedSnapshot;
            this.applySnapshot(snap);
          } catch {
            /* ignore malformed */
          }
        });
      };
      this.eventSource.onerror = () => {
        this.closeSse();
        this.diagnostics.setFeedTransport('poll');
        this.startPollFallback();
      };
      this.refreshFeed().subscribe();
    } catch {
      this.diagnostics.setFeedTransport('poll');
      this.startPollFallback();
    }
  }

  private closeSse(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private startPollFallback(): void {
    if (this.pollTimer || !this.connected) return;
    this.pollTimer = setInterval(() => {
      if (this.pollInFlight || document.hidden) return;
      this.pollInFlight = true;
      this.refreshFeed().subscribe({
        complete: () => { this.pollInFlight = false; },
        error: () => { this.pollInFlight = false; }
      });
    }, FEED_POLL_MS);
  }

  private stopPollFallback(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.diagnostics.setFeedTransport('idle');
  }

  private applySnapshot(snap: ExecutionFeedSnapshot): void {
    if (snap.nanoScanGeneration !== this.lastGeneration) {
      this.lastGeneration = snap.nanoScanGeneration;
    }
    this.feedSubject.next(snap);
    this.store.patchFeed(snap);
    this.recomputeEnriched(snap.feed);
  }

  private recomputeEnriched(feed: ExecutionFeedItem[]): void {
    const enriched = visibleEnrichedFeed(
      feed,
      this.traderMode.isExecution() ? 'EXECUTION' : 'RESEARCH',
      this.executionMode
    );
    this.enrichedSubject.next(enriched);
  }

  private emptyFeed(): ExecutionFeedSnapshot {
    return {
      advisoryOnly: true,
      generatedAt: Date.now(),
      symbolCount: 0,
      nanoScanGeneration: 0,
      feed: [],
      summaryInsights: ['Waiting for nano scanner…']
    };
  }
}
