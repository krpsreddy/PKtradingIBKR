import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map } from 'rxjs';
import { TradingSymbol } from '../../models/trading-symbol.model';
import { DebugPanel, SystemStatus } from '../../models/system-status.model';
import {
  ActiveSignal,
  HotMomentumItem,
  OpeningMomentumItem,
  MarketTrend
} from '../../models/workspace.model';
import { EmergingSetup } from '../../models/refinement.model';
import { ScannerSnapshot } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';
import { ExecutionFeedSnapshot } from '../real-time-execution/real-time-execution.models';

/** Central reactive store — single source of truth for dashboard data. */
@Injectable({ providedIn: 'root' })
export class DashboardStateStoreService {
  private readonly selectedSymbolSubject = new BehaviorSubject<string>('NVDA');
  private readonly watchlistSubject = new BehaviorSubject<TradingSymbol[]>([]);
  private readonly statusSubject = new BehaviorSubject<SystemStatus | null>(null);
  private readonly debugSubject = new BehaviorSubject<DebugPanel | null>(null);
  private readonly activeSignalsSubject = new BehaviorSubject<ActiveSignal[]>([]);
  private readonly hotSubject = new BehaviorSubject<HotMomentumItem[]>([]);
  private readonly continuationSubject = new BehaviorSubject<HotMomentumItem[]>([]);
  private readonly openingSubject = new BehaviorSubject<OpeningMomentumItem[]>([]);
  private readonly failedSubject = new BehaviorSubject<HotMomentumItem[]>([]);
  private readonly marketTrendSubject = new BehaviorSubject<MarketTrend | null>(null);
  private readonly emergingSubject = new BehaviorSubject<EmergingSetup[]>([]);
  private readonly scannerSubject = new BehaviorSubject<ScannerSnapshot | null>(null);
  private readonly feedSubject = new BehaviorSubject<ExecutionFeedSnapshot | null>(null);
  private readonly chartModeSubject = new BehaviorSubject<'LIVE' | 'REPLAY'>('LIVE');
  private readonly miniModeSubject = new BehaviorSubject(false);

  readonly selectedSymbol$ = this.selectedSymbolSubject.asObservable();
  readonly watchlist$ = this.watchlistSubject.asObservable();
  readonly watchlistSymbols$ = this.watchlist$.pipe(
    map(list => list.map(s => s.symbol.toUpperCase())),
    distinctUntilChanged((a, b) => a.join() === b.join())
  );
  readonly status$ = this.statusSubject.asObservable();
  readonly activeSignals$ = this.activeSignalsSubject.asObservable();
  readonly scanner$ = this.scannerSubject.asObservable();
  readonly feed$ = this.feedSubject.asObservable();

  selectedSymbol(): string {
    return this.selectedSymbolSubject.value;
  }

  setSelectedSymbol(symbol: string): void {
    const sym = symbol.toUpperCase();
    if (sym !== this.selectedSymbolSubject.value) {
      this.selectedSymbolSubject.next(sym);
    }
  }

  patchWatchlist(symbols: TradingSymbol[]): void {
    this.watchlistSubject.next(symbols);
  }

  mergeEnrichedSymbols(partial: TradingSymbol[]): void {
    const map = new Map(this.watchlistSubject.value.map(s => [s.symbol, s]));
    for (const row of partial) {
      map.set(row.symbol, { ...map.get(row.symbol), ...row });
    }
    this.watchlistSubject.next([...map.values()]);
  }

  patchLightPoll(data: {
    status: SystemStatus | null;
    debug: DebugPanel | null;
    hot: HotMomentumItem[];
    continuation: HotMomentumItem[];
    opening: OpeningMomentumItem[];
    failed: HotMomentumItem[];
    market: MarketTrend | null;
    emerging: EmergingSetup[];
  }): void {
    this.statusSubject.next(data.status);
    this.debugSubject.next(data.debug);
    this.hotSubject.next(data.hot);
    this.continuationSubject.next(data.continuation);
    this.openingSubject.next(data.opening);
    this.failedSubject.next(data.failed);
    this.marketTrendSubject.next(data.market);
    this.emergingSubject.next(data.emerging);
  }

  patchActiveSignals(signals: ActiveSignal[]): void {
    this.activeSignalsSubject.next(signals);
  }

  patchScanner(snap: ScannerSnapshot | null): void {
    this.scannerSubject.next(snap);
  }

  patchFeed(snap: ExecutionFeedSnapshot | null): void {
    this.feedSubject.next(snap);
  }

  /** Phase 178 — tier-1 nano boosts (no scanner HTTP). */
  patchNanoBoosts(_boosts: Map<string, import('../real-time-execution/nano-scanner.engine').NanoScanResult>): void {
    // Nano reprioritization handled in RealTimeExecutionService; store hook for future UI.
  }

  setChartMode(mode: 'LIVE' | 'REPLAY'): void {
    this.chartModeSubject.next(mode);
  }

  chartMode(): 'LIVE' | 'REPLAY' {
    return this.chartModeSubject.value;
  }

  setMiniMode(mini: boolean): void {
    this.miniModeSubject.next(mini);
  }

  isMiniMode(): boolean {
    return this.miniModeSubject.value;
  }

  snapshot() {
    return {
      selectedSymbol: this.selectedSymbolSubject.value,
      watchlist: this.watchlistSubject.value,
      status: this.statusSubject.value,
      activeSignals: this.activeSignalsSubject.value,
      marketTrend: this.marketTrendSubject.value,
      scanner: this.scannerSubject.value,
      feed: this.feedSubject.value
    };
  }
}
