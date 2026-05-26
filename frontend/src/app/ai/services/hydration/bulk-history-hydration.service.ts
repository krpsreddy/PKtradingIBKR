import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { catchError, of, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SIGNAL_INTELLIGENCE_LOOKBACK_DAYS } from '../../../models/signal-intelligence.model';
import { SymbolEdgeAnalysisService } from '../symbol-edge-analysis.service';
import { SymbolEdgeProfileStore } from '../symbol-edge-profile.store';
import { SignalIntelligenceStore } from '../../../services/signal-intelligence/signal-intelligence.store';
import { HistoricalCandleMergeService } from './historical-candle-merge.service';
import { HistoricalHydrationQueueService, HydrationQueueJob } from './historical-hydration-queue.service';
import {
  evaluatedSessionDatesFromSignals,
  mergeEvaluatedSessionDates,
  reconcileHydrationState
} from './hydration-reconcile.util';
import { MissingHistoryRangeResolver } from './missing-history-range.resolver';
import { SymbolHistoryHydrationStore } from './symbol-history-hydration.store';
import { HydrationStateService } from '../../../services/signal-intelligence/persistent-analytics/hydration-state.service';
import { AnalyticsSyncService } from '../../../services/signal-intelligence/persistent-analytics/analytics-sync.service';
import { LazyAnalyticsEnrichmentService } from '../../../services/signal-intelligence/replay-cache/lazy-analytics-enrichment.service';
import { HydrationCachePhase } from '../../../services/signal-intelligence/replay-cache/replay-cache.models';
import {
  BulkHydrationOptions,
  BulkHydrationProgress,
  HYDRATION_PARALLEL_MAX,
  HYDRATION_PARALLEL_SYMBOLS,
  HYDRATION_SCAN_PARALLEL,
  HYDRATION_TARGET_SESSION_DAYS,
  HydrationJobResult,
  HydrationLabRow,
  SymbolHistoryCoverage,
  SymbolHistoryHydrationState
} from './symbol-history-hydration.models';

/** Orchestrates incremental 60D history hydration for all watchlist symbols. */
@Injectable({ providedIn: 'root' })
export class BulkHistoryHydrationService {
  private readonly resolver = new MissingHistoryRangeResolver();
  private readonly coverageBase = `${environment.apiUrl}/symbols`;

  private readonly progressSubject = new BehaviorSubject<BulkHydrationProgress>(this.emptyProgress());
  readonly progress$ = this.progressSubject.asObservable();

  private completed = 0;
  private skipped = 0;
  private failed = 0;
  private totalSymbols = 0;
  private startedAt: number | null = null;
  private autoAnalyze = true;
  private parallelism = HYDRATION_PARALLEL_SYMBOLS;

  constructor(
    private http: HttpClient,
    private hydrationStore: SymbolHistoryHydrationStore,
    private mergeService: HistoricalCandleMergeService,
    private queue: HistoricalHydrationQueueService,
    private edgeService: SymbolEdgeAnalysisService,
    private profileStore: SymbolEdgeProfileStore,
    private signalStore: SignalIntelligenceStore,
    private hydrationState: HydrationStateService,
    private lazyEnrichment: LazyAnalyticsEnrichmentService,
    private analyticsSync: AnalyticsSyncService
  ) {
    this.queue.setWorker(job => this.processJob(job));
  }

  /** Start bulk hydration — priority symbols hydrate first. */
  startBulkHydration(symbols: string[], options: BulkHydrationOptions = {}): void {
    const lookbackDays = options.lookbackDays ?? SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    this.autoAnalyze = options.autoAnalyze ?? true;
    this.parallelism = Math.max(1, Math.min(HYDRATION_PARALLEL_MAX, options.parallelism ?? HYDRATION_PARALLEL_SYMBOLS));
    this.queue.setMaxConcurrency(this.parallelism);
    let unique = [...new Set(symbols.map(s => s.toUpperCase()))];
    if (options.prioritySymbol) {
      const pri = options.prioritySymbol.toUpperCase();
      unique = [pri, ...unique.filter(s => s !== pri)];
    }
    this.totalSymbols = unique.length;
    this.completed = 0;
    this.skipped = 0;
    this.failed = 0;
    this.startedAt = Date.now();

    this.queue.clearPendingForSymbols(unique);
    void this.scanAndEnqueue(unique, lookbackDays, options.force ?? false);
  }

  retrySymbol(symbol: string, lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS): void {
    this.queue.retry(symbol, lookbackDays, this.autoAnalyze);
    this.emitProgress(true);
  }

  snapshot(): BulkHydrationProgress {
    return this.progressSubject.value;
  }

  buildLabRows(symbols: string[]): HydrationLabRow[] {
    return symbols.map(sym => {
      const s = sym.toUpperCase();
      const hydration = this.hydrationStore.get(s);
      const profile = this.profileStore.get(s);
      const loaded = Math.max(hydration.loadedDays, 0);
      const historyComplete = loaded >= HYDRATION_TARGET_SESSION_DAYS;
      return {
        symbol: s,
        historyLabel: historyComplete
          ? `${loaded} sessions`
          : `${loaded}/${HYDRATION_TARGET_SESSION_DAYS} sessions`,
        historyComplete,
        signalCount: hydration.signalCount || profile?.evaluatedTrades || 0,
        edgeScore: profile?.edgeScore ?? 0,
        status: hydration.hydrationStatus,
        queueState: hydration.queueState,
        statusDetail: this.rowStatusDetail(hydration)
      };
    });
  }

  private rowStatusDetail(hydration: SymbolHistoryHydrationState): string | null {
    if (hydration.hydrationStatus === 'LOADING' && hydration.currentPhase) {
      return hydration.currentPhase;
    }
    if (hydration.hydrationStatus === 'LOADING') return 'Replaying signals…';
    if (hydration.hydrationStatus === 'PARTIAL' && hydration.queueState === 'QUEUED') return 'Queued';
    if (hydration.hydrationStatus === 'PARTIAL' && hydration.signalCount === 0) return 'Waiting for replay';
    if (hydration.hydrationStatus === 'READY' && hydration.queueState === 'SKIPPED') return 'Already loaded';
    return null;
  }

  private async scanAndEnqueue(symbols: string[], lookbackDays: number, force: boolean): Promise<void> {
    const jobs: Omit<HydrationQueueJob, 'retries' | 'state'>[] = [];
    let skippedDuringScan = 0;

    await this.runPool(symbols, HYDRATION_SCAN_PARALLEL, async sym => {
      const coverage = await this.fetchCoverage(sym, lookbackDays);
      const signalDates = this.signalDatesForSymbol(sym, lookbackDays);
      const reconciled = reconcileHydrationState(
        this.hydrationStore.get(sym),
        coverage,
        signalDates,
        lookbackDays
      );
      if (Object.keys(reconciled).length) {
        this.hydrationStore.upsert(sym, reconciled);
      }

      const hydration = this.hydrationStore.get(sym);
      const effectiveDates = mergeEvaluatedSessionDates(hydration, signalDates);
      const plan = this.resolver.resolve(coverage, hydration, lookbackDays, force, effectiveDates);

      if (plan.skip) {
        skippedDuringScan++;
        this.hydrationStore.upsert(sym, {
          hydrationStatus: 'READY',
          queueState: 'SKIPPED',
          loadedDays: coverage.loadedSessionDays,
          missingRanges: [],
          replayEvaluated: true,
          evaluatedSessionDates: effectiveDates
        });
        return;
      }

      this.hydrationStore.upsert(sym, {
        hydrationStatus: coverage.loadedSessionDays > 0 ? 'PARTIAL' : 'NOT_STARTED',
        queueState: 'QUEUED',
        missingRanges: plan.missingRanges,
        targetDays: lookbackDays,
        loadedDays: coverage.loadedSessionDays
      });

      jobs.push({ symbol: sym, lookbackDays, autoAnalyze: this.autoAnalyze, force });
    });

    this.skipped += skippedDuringScan;
    this.queue.enqueue(jobs);
    const summaryMessage = jobs.length === 0
      ? `All ${this.totalSymbols} symbols already hydrated — skipped reload (candles + signals in store).`
      : null;
    this.emitProgress(jobs.length > 0, summaryMessage);
  }

  /** Bounded parallel map — used for coverage scan and replay workers. */
  private async runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const i = index++;
        await fn(items[i]);
      }
    });
    await Promise.all(workers);
  }

  private signalDatesForSymbol(symbol: string, lookbackDays: number): string[] {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    return evaluatedSessionDatesFromSignals(this.signalStore.query({ symbol, fromTs }));
  }

  private async processJob(job: HydrationQueueJob): Promise<HydrationJobResult> {
    const sym = job.symbol;
    this.hydrationStore.upsert(sym, {
      hydrationStatus: 'LOADING',
      queueState: 'LOADING',
      currentPhase: 'Starting…'
    });
    this.emitProgress(true);

    const jobTimeoutMs = 240_000;

    try {
      const result = await Promise.race([
        this.runHydrationJob(job, sym),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Hydration timed out after ${jobTimeoutMs / 1000}s`)), jobTimeoutMs)
        )
      ]);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Hydration failed';
      this.failed++;
      this.hydrationStore.upsert(sym, {
        hydrationStatus: 'FAILED',
        queueState: 'FAILED',
        currentPhase: null,
        error: message
      });
      this.emitProgress(false);
      throw err;
    }
  }

  private async runHydrationJob(job: HydrationQueueJob, sym: string): Promise<HydrationJobResult> {
    const coverageBefore = await this.fetchCoverage(sym, job.lookbackDays);
    const signalDates = this.signalDatesForSymbol(sym, job.lookbackDays);
    const reconciled = reconcileHydrationState(
      this.hydrationStore.get(sym),
      coverageBefore,
      signalDates,
      job.lookbackDays
    );
    if (Object.keys(reconciled).length) {
      this.hydrationStore.upsert(sym, reconciled);
    }

    const hydration = this.hydrationStore.get(sym);
    const effectiveDates = mergeEvaluatedSessionDates(hydration, signalDates);
    const plan = this.resolver.resolve(coverageBefore, hydration, job.lookbackDays, job.force, effectiveDates);

    if (plan.skip) {
      this.skipped++;
      this.hydrationStore.upsert(sym, {
        hydrationStatus: 'READY',
        queueState: 'SKIPPED',
        missingRanges: [],
        replayEvaluated: true,
        evaluatedSessionDates: effectiveDates,
        currentPhase: null
      });
      this.completed++;
      this.emitProgress(true);
      return { symbol: sym, skipped: true, recorded: 0, sessions: 0, loadedDays: coverageBefore.loadedSessionDays };
    }

    const backfill = await this.edgeService.hydrateSymbol(sym, job.lookbackDays, {
      evaluatedSessionDates: effectiveDates,
      forceFetch: !coverageBefore.fullyLoaded && coverageBefore.totalCandles < 10,
      onPhase: (phase, detail) => {
        const label = this.phaseLabel(phase, detail);
        this.hydrationStore.upsert(sym, { currentPhase: label });
        this.emitProgress(true);
      }
    });

    const coverageAfter = await this.fetchCoverage(sym, job.lookbackDays);
    const merged = this.mergeService.applyCoverage(hydration.totalCandlesLoaded, coverageAfter);
    const fromTs = Date.now() - job.lookbackDays * 86_400_000;
    const signalCount = this.signalStore.query({ symbol: sym, fromTs }).filter(s => s.evaluation?.status).length;

    const newEvaluatedDates = backfill.replayedDates;
    this.hydrationStore.markEvaluatedSessions(sym, newEvaluatedDates);

    const isReady = coverageAfter.fullyLoaded || coverageAfter.loadedSessionDays >= HYDRATION_TARGET_SESSION_DAYS;

    this.hydrationStore.upsert(sym, {
      ...merged,
      hydrationStatus: isReady ? 'READY' : 'PARTIAL',
      queueState: 'READY',
      currentPhase: null,
      lastHydratedAt: Date.now(),
      missingRanges: isReady ? [] : plan.missingRanges,
      replayEvaluated: true,
      signalCount,
      totalCandlesLoaded: backfill.candlesStored ?? merged.totalCandlesLoaded
    });

    void this.hydrationState.persistSymbol(this.hydrationStore.get(sym));
    void this.analyticsSync.forceBulkSync();

    if (job.autoAnalyze && backfill.recorded >= 0) {
      this.hydrationStore.upsert(sym, { aiAnalyzed: false });
    }

    this.completed++;
    this.emitProgress(true);

    if (this.completed + this.skipped >= this.totalSymbols) {
      this.lazyEnrichment.scheduleEnrichment(300);
    }

    return {
      symbol: sym,
      skipped: false,
      recorded: backfill.recorded,
      sessions: backfill.sessions,
      loadedDays: coverageAfter.loadedSessionDays
    };
  }

  private async fetchCoverage(symbol: string, days: number): Promise<SymbolHistoryCoverage> {
    return firstValueFrom(
      this.http.get<SymbolHistoryCoverage>(`${this.coverageBase}/${symbol}/history-coverage`, {
        params: { days: String(days) }
      }).pipe(
        timeout(15_000),
        catchError(() => of({
          symbol: symbol.toUpperCase(),
          lookbackDays: days,
          loadedSessionDays: 0,
          totalCandles: 0,
          earliestTimestamp: null,
          latestTimestamp: null,
          sessionDates: [],
          fullyLoaded: false,
          message: 'Coverage request failed'
        }))
      )
    );
  }

  private emitProgress(running: boolean, summaryMessage: string | null = null): void {
    const active = this.queue.activeSymbols();
    const queueActive = this.queue.isRunning();
    const label = active.length === 0
      ? null
      : active.length === 1
        ? `Loading ${active[0]}…`
        : `${active.length} symbols in parallel (${active.slice(0, 3).join(', ')}${active.length > 3 ? '…' : ''})`;

    this.progressSubject.next({
      running: running || queueActive,
      totalSymbols: this.totalSymbols,
      completed: this.completed,
      skipped: this.skipped,
      failed: this.failed,
      queueSize: this.queue.queueSize(),
      currentSymbol: active[0] ?? null,
      currentLabel: label,
      activeSymbols: active,
      parallelism: this.parallelism,
      autoAnalyze: this.autoAnalyze,
      startedAt: this.startedAt,
      estimatedRemainingMs: this.queue.estimatedRemainingMs(),
      summaryMessage: !queueActive && !running ? summaryMessage : null
    });
  }

  private phaseLabel(phase: string, detail?: string): string {
    if (detail) return detail;
    switch (phase) {
      case 'fetch': return 'Fetching history…';
      case 'snapshots': return 'Loading replay snapshots…';
      case 'validate': return 'Validating cached analytics…';
      case 'stale-replay':
      case 'replay': return 'Replaying stale sessions…';
      case 'evaluate': return 'Evaluating signals…';
      case 'enrich': return 'Background enrichment…';
      default: return 'Hydrating…';
    }
  }

  private emptyProgress(): BulkHydrationProgress {
    return {
      running: false,
      totalSymbols: 0,
      completed: 0,
      skipped: 0,
      failed: 0,
      queueSize: 0,
      currentSymbol: null,
      currentLabel: null,
      activeSymbols: [],
      parallelism: HYDRATION_PARALLEL_SYMBOLS,
      autoAnalyze: true,
      startedAt: null,
      estimatedRemainingMs: null,
      summaryMessage: null
    };
  }
}

