import { Injectable, OnDestroy } from '@angular/core';
import {
  Observable,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  takeUntil
} from 'rxjs';
import { DashboardSchedulerService } from './dashboard-scheduler.service';
import { DashboardStateStoreService } from './dashboard-state-store.service';
import { SymbolEnrichmentQueueService } from './symbol-enrichment-queue.service';
import { SystemStatusService } from '../system-status.service';
import { DebugService } from '../debug.service';
import { MomentumService } from '../momentum.service';
import { MarketTrendService } from '../market-trend.service';
import { ExecutionApiService } from '../refinement.service';
import { SignalService } from '../signal.service';
import { MarketHeartbeatService } from '../market-heartbeat.service';
import { AutonomousRegimeScannerService } from '../autonomous-regime-scanner/autonomous-regime-scanner.service';
import { AnalyticsService } from '../analytics.service';
import { TradeJournalService } from '../refinement.service';
import { CognitionService } from '../cognition.service';
import { ProbabilisticService } from '../probabilistic.service';
import { HistoricalService } from '../historical.service';
import { AiExecutionIntelligenceService } from '../../ai/services/ai-execution-intelligence.service';
import { CandleService } from '../candle.service';
import { IndicatorService } from '../indicator.service';
import { WorkspaceModeService } from '../workspace-mode.service';
import { HttpRequestManagerService } from '../network/http-request-manager.service';
import { RealTimeExecutionService } from '../real-time-execution/real-time-execution.service';
import { bindScanEnabled, DashboardTaskId } from './dashboard-scheduler.config';
import { RuntimeScanControlService } from '../runtime-scan/runtime-scan-control.service';
import { NanoPulseService } from '../runtime-scan/nano-pulse.service';
import { TradingSymbol } from '../../models/trading-symbol.model';
import { SymbolCacheEntry } from '../../models/workspace.model';

function safeApi<T>(obs: import('rxjs').Observable<T>, fallback: T): import('rxjs').Observable<T> {
  return obs.pipe(catchError(() => of(fallback)));
}

export interface LightPollPayload {
  symbols: TradingSymbol[];
  status: import('../../models/system-status.model').SystemStatus | null;
  debug: import('../../models/system-status.model').DebugPanel | null;
  hot: import('../../models/workspace.model').HotMomentumItem[];
  continuation: import('../../models/workspace.model').HotMomentumItem[];
  opening: import('../../models/workspace.model').OpeningMomentumItem[];
  failed: import('../../models/workspace.model').HotMomentumItem[];
  market: import('../../models/workspace.model').MarketTrend | null;
  emerging: import('../../models/refinement.model').EmergingSetup[];
}

export interface HeavyPollPayload {
  journal: import('../../models/refinement.model').TradeJournalEntry[];
  edge: import('../../models/analytics.model').TraderEdge | null;
  behavior: import('../../models/analytics.model').BehaviorInsight[];
  memory: import('../../models/analytics.model').MarketMemory | null;
}

/** Coordinates scheduler ticks → deduped HTTP → state store. */
@Injectable({ providedIn: 'root' })
export class DashboardOrchestratorService implements OnDestroy {
  private readonly lifecycle$ = new Subject<void>();
  private pollSubs = new Subscription();
  private running = false;
  private lastWatchlistKey = '';

  private readonly lightPollSubject = new Subject<LightPollPayload>();
  private readonly heavyPollSubject = new Subject<HeavyPollPayload>();
  private readonly activeSymbolSubject = new Subject<SymbolCacheEntry>();
  private readonly heartbeatSubject = new Subject<import('../market-heartbeat.service').MarketHeartbeat | null>();
  private readonly confidenceRefreshSubject = new Subject<void>();
  private readonly planRefreshSubject = new Subject<void>();

  readonly lightPoll$ = this.lightPollSubject.asObservable();
  readonly heavyPoll$ = this.heavyPollSubject.asObservable();
  readonly activeSymbol$ = this.activeSymbolSubject.asObservable();
  readonly heartbeat$ = this.heartbeatSubject.asObservable();
  readonly confidenceRefresh$ = this.confidenceRefreshSubject.asObservable();
  /** Phase 178 — tier-2 execution plan refresh (focused symbol only). */
  readonly planRefresh$ = this.planRefreshSubject.asObservable();

  constructor(
    private scheduler: DashboardSchedulerService,
    private store: DashboardStateStoreService,
    private enrichQueue: SymbolEnrichmentQueueService,
    private systemStatus: SystemStatusService,
    private debugService: DebugService,
    private momentum: MomentumService,
    private marketTrend: MarketTrendService,
    private executionApi: ExecutionApiService,
    private signals: SignalService,
    private heartbeat: MarketHeartbeatService,
    private autonomousScanner: AutonomousRegimeScannerService,
    private analytics: AnalyticsService,
    private journal: TradeJournalService,
    private cognition: CognitionService,
    private probabilistic: ProbabilisticService,
    private historical: HistoricalService,
    private aiExecution: AiExecutionIntelligenceService,
    private candles: CandleService,
    private indicators: IndicatorService,
    private workspaceMode: WorkspaceModeService,
    private requestManager: HttpRequestManagerService,
    private rtExecution: RealTimeExecutionService,
    private scanControl: RuntimeScanControlService,
    private nanoPulse: NanoPulseService
  ) {
    bindScanEnabled(() => this.scanControl.isScanningEnabled());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduler.start();
    if (this.scanControl.isScanningEnabled()) {
      this.rtExecution.connect();
    } else {
      this.scheduler.pause();
    }

    this.pollSubs.add(
      this.scanControl.state$.pipe(
        map(s => s.enabled),
        distinctUntilChanged()
      ).subscribe(enabled => {
        if (enabled) {
          this.scheduler.resume();
          this.rtExecution.connect();
        } else {
          this.scheduler.pause();
          this.rtExecution.disconnect();
        }
      })
    );

    this.pollSubs.add(
      this.scheduler.tick$.subscribe(task => this.onTask(task))
    );

    this.pollSubs.add(
      this.store.selectedSymbol$.pipe(
        distinctUntilChanged(),
        debounceTime(200)
      ).subscribe(sym => {
        this.scheduler.trigger('symbolContext');
        this.scheduler.trigger('activeSymbol');
        if (this.scanControl.isScanningEnabled()) {
          this.scheduler.trigger('executionPlanRefresh');
        }
        this.scheduleEnrichmentIfNeeded([sym]);
      })
    );

    this.runInitialBootstrap();
  }

  requestSymbolContextRefresh(): void {
    this.scheduler.trigger('symbolContext');
  }

  requestActiveSymbolRefresh(): void {
    this.scheduler.trigger('activeSymbol');
  }

  stop(): void {
    this.running = false;
    this.scheduler.stop();
    this.rtExecution.disconnect();
    this.pollSubs.unsubscribe();
    this.pollSubs = new Subscription();
  }

  ngOnDestroy(): void {
    this.stop();
    this.lifecycle$.complete();
  }

  private runInitialBootstrap(): void {
    this.enrichQueue.loadBaseSymbols().subscribe(symbols => {
      this.store.patchWatchlist(symbols);
      this.lightPollSubject.next({
        symbols,
        status: null,
        debug: null,
        hot: [],
        continuation: [],
        opening: [],
        failed: [],
        market: null,
        emerging: []
      });
      this.scheduleEnrichmentIfNeeded(symbols.map(s => s.symbol));
    });
    this.onTask('systemLight');
    this.onTask('activeSignals');
  }

  private onTask(task: DashboardTaskId): void {
    switch (task) {
      case 'nanoPulse':
        this.runNanoPulse();
        break;
      case 'executionFeed':
        if (this.scanControl.isScanningEnabled()) {
          this.rtExecution.refreshFeed().subscribe();
        }
        break;
      case 'executionPlanRefresh':
        this.planRefreshSubject.next();
        break;
      case 'activeSymbol':
        if (this.store.chartMode() !== 'REPLAY') this.refreshActiveSymbol();
        break;
      case 'activeSignals':
        this.refreshActiveSignals();
        break;
      case 'systemLight':
        this.refreshLightPoll();
        break;
      case 'scanner':
        if (this.scanControl.isScanningEnabled()) this.refreshScanner();
        break;
      case 'marketHeartbeat':
        if (this.store.chartMode() !== 'REPLAY') this.refreshHeartbeat();
        break;
      case 'aiExecution':
        if (this.workspaceMode.isExecution() && this.store.chartMode() === 'LIVE' && !this.store.isMiniMode()) {
          this.refreshAiExecution();
        }
        break;
      case 'symbolContext':
        this.refreshSymbolContext();
        break;
      case 'analyticsHeavy':
        this.refreshHeavyPoll();
        break;
    }
  }

  private refreshLightPoll(): void {
    const key = 'dashboard:light';
    this.requestManager
      .get(
        key,
        () =>
          forkJoin({
            symbols: safeApi(this.enrichQueue.loadBaseSymbols(), []),
            status: safeApi(this.systemStatus.getStatus(), null),
            debug: safeApi(this.debugService.getPanel(), null),
            hot: safeApi(this.momentum.getHot(), []),
            continuation: safeApi(this.momentum.getContinuation(), []),
            opening: safeApi(this.momentum.getOpening(), []),
            failed: safeApi(this.momentum.getFailed(), []),
            market: safeApi(this.marketTrend.getTrend(), null),
            emerging: safeApi(this.executionApi.getEmergingSetups(), [])
          }),
        { cacheKey: key, cacheBucket: 'momentumBundle', cancelPrevious: true }
      )
      .subscribe(payload => {
        this.store.patchWatchlist(payload.symbols);
        this.store.patchLightPoll(payload);
        this.lightPollSubject.next(payload);
      });
  }

  private scheduleEnrichmentIfNeeded(symbols: string[], visible: string[] = []): void {
    const vis = visible.length ? visible : [this.store.selectedSymbol()];
    const key = [...symbols].sort().join(',');
    if (key === this.lastWatchlistKey) return;
    this.lastWatchlistKey = key;
    this.enrichQueue.schedule(symbols, vis);
  }

  private refreshHeavyPoll(): void {
    const key = 'dashboard:heavy';
    this.requestManager
      .get(
        key,
        () =>
          forkJoin({
            journal: safeApi(this.journal.list(), []),
            edge: safeApi(this.analytics.getEdge(60), null),
            behavior: safeApi(this.analytics.getBehavior(), []),
            memory: safeApi(this.analytics.getMemory(), null)
          }),
        { cacheKey: key, cacheBucket: 'aiInsight', cancelPrevious: true, timeoutMs: 60_000 }
      )
      .subscribe(payload => {
        this.heavyPollSubject.next(payload);
        this.confidenceRefreshSubject.next();
      });
  }

  private refreshActiveSignals(): void {
    const key = 'signals:active';
    this.requestManager
      .get(key, () => this.signals.getActive(), {
        cacheKey: key,
        cacheBucket: 'activeSignals',
        cancelPrevious: true
      })
      .subscribe(active => this.store.patchActiveSignals(active));
  }

  private refreshHeartbeat(): void {
    const key = 'market:heartbeat';
    this.requestManager
      .get(key, () => this.heartbeat.getHeartbeat(), {
        cacheKey: key,
        cacheBucket: 'snapshot',
        cancelPrevious: true
      })
      .subscribe(hb => this.heartbeatSubject.next(hb));
  }

  private refreshScanner(): void {
    const symbols =
      this.store.snapshot().watchlist.map(s => s.symbol) ||
      this.store.snapshot().activeSignals.map(s => s.symbol);
    if (!symbols.length) return;
    const key = `scanner:${symbols.join(',')}`;
    this.requestManager
      .get(
        key,
        () => this.autonomousScanner.scan(symbols, false),
        { cacheKey: key, cacheBucket: 'scanner', cancelPrevious: true }
      )
      .subscribe(snap => this.store.patchScanner(snap));
  }

  private refreshActiveSymbol(): void {
    const sym = this.store.selectedSymbol();
    const key = `symbol:data:${sym}`;
    this.requestManager
      .get(
        key,
        () =>
          forkJoin({
            candles: this.candles.getLatest(sym),
            indicators: this.indicators.getLatest(sym),
            signals: this.signals.getLatest(sym)
          }).pipe(map(data => ({ ...data, symbol: sym } as SymbolCacheEntry))),
        { cacheKey: key, cacheBucket: 'snapshot', cancelPrevious: true }
      )
      .subscribe(data => this.activeSymbolSubject.next(data));
  }

  private refreshSymbolContext(): void {
    const sym = this.store.selectedSymbol();
    const typeKey = 'WATCH';
    this.pollSubs.add(this.cognition.getSnapshot(sym).subscribe());
    this.pollSubs.add(this.probabilistic.getSnapshot(sym, typeKey).subscribe());
  }

  private refreshAiExecution(): void {
    const sym = this.store.selectedSymbol();
    this.aiExecution.analyzeExecution(sym, 'WATCH').catch(() => {});
  }

  private runNanoPulse(): void {
    if (!this.scanControl.isScanningEnabled()) return;
    const t0 = performance.now();
    this.scanControl.recordTickStart();
    const symbols = this.store.snapshot().watchlist;
    const boosts = this.nanoPulse.tick(symbols);
    this.rtExecution.applyNanoPrioritization(boosts);
    this.scanControl.recordTickEnd(performance.now() - t0, 1, symbols.length);
  }
}
