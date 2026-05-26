import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../../services/signal-intelligence/signal-intelligence.store';
import { SignalIntelligenceEngine } from '../../services/signal-intelligence/signal-intelligence.engine';
import { ReplayService } from '../../services/replay.service';
import { SymbolService } from '../../services/symbol.service';
import { SystemStatusService } from '../../services/system-status.service';
import { SystemStatus } from '../../models/system-status.model';
import { SymbolSubscribeResponse } from '../../models/workspace.model';
import { filterSessionsForReplay } from './hydration/hydration-replay.util';
import { IncrementalHydrationService } from '../../services/signal-intelligence/replay-cache/incremental-hydration.service';
import { LazyAnalyticsEnrichmentService } from '../../services/signal-intelligence/replay-cache/lazy-analytics-enrichment.service';
import { HydrationCachePhase } from '../../services/signal-intelligence/replay-cache/replay-cache.models';
import { buildSymbolEdgeSummary } from '../symbol-edge-analytics.engine';
import {
  SymbolEdgeAnalysisResponse,
  SymbolEdgeCompressedSummary,
  SymbolEdgeProfile,
  SymbolEdgeRankingRow
} from '../models/symbol-edge.models';
import { SymbolEdgeProfileStore } from './symbol-edge-profile.store';

const AI_TIMEOUT_MS = 15_000;
const HISTORY_POLL_MS = 1_000;
const HISTORY_MAX_WAIT_MS = 90_000;

const EMPTY_AI = {
  strengths: [] as string[],
  weaknesses: ['Insufficient evaluated history — collect more signal intelligence samples.'],
  bestConditions: [] as string[],
  avoidConditions: [] as string[],
  optimizationSuggestions: ['Review setup×regime matrix before changing thresholds.'],
  executionNotes: [
    'Analytics only — no automatic strategy changes.',
    'Human approval required for all threshold adjustments.'
  ],
  confidence: 'LOW' as const,
  confidenceScore: 0.35,
  summary: ''
};

export interface SymbolEdgeBackfillResult {
  recorded: number;
  sessions: number;
  totalSignals: number;
  candlesStored: number;
  historyStatus: string;
  historyMessage: string;
  replayedDates: string[];
  error?: string;
}

export interface HydrateSymbolOptions {
  evaluatedSessionDates?: string[];
  forceFetch?: boolean;
  forceReplay?: boolean;
  onPhase?: (phase: 'fetch' | 'replay' | 'evaluate' | HydrationCachePhase, detail?: string) => void;
}

export interface AnalyzeSymbolOptions {
  forceRefresh?: boolean;
}

/**
 * Unified symbol-agnostic edge intelligence pipeline.
 * History load → signal evaluation → deterministic stats → cached AI summary → profile store.
 */
@Injectable({ providedIn: 'root' })
export class SymbolEdgeAnalysisService {
  private base = `${environment.apiUrl}/ai`;

  constructor(
    private http: HttpClient,
    private store: SignalIntelligenceStore,
    private signalIntel: SignalIntelligenceEngine,
    private replayService: ReplayService,
    private symbolService: SymbolService,
    private systemStatus: SystemStatusService,
    private profileStore: SymbolEdgeProfileStore,
    private incrementalHydration: IncrementalHydrationService,
    private lazyEnrichment: LazyAnalyticsEnrichmentService
  ) {}

  /** Evaluate cached replay sessions into the signal store (no IBKR fetch). */
  async materializeFromReplayCache(
    symbol: string,
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS
  ): Promise<number> {
    const sym = symbol.toUpperCase();
    const hydration = await this.incrementalHydration.hydrateSymbol(sym, lookbackDays, {});
    const sessions = (hydration.bulk.sessions ?? []).filter(
      s => (s.timeline?.length ?? 0) > 0 && (s.sessionCandles?.length ?? 0) > 0
    );
    if (!sessions.length) return 0;
    return this.signalIntel.bootstrapBulkFromReplay(sessions);
  }

  /** Load IBKR history + bulk replay into Signal Intelligence for any symbol. */
  async loadHistory(
    symbol: string,
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS
  ): Promise<SymbolEdgeBackfillResult> {
    return this.hydrateSymbol(symbol, lookbackDays, { forceFetch: true });
  }

  /**
   * Incremental hydration — skips already-evaluated sessions, optional IBKR fetch.
   * Phase 135 bulk engine entry point.
   */
  async hydrateSymbol(
    symbol: string,
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
    options: HydrateSymbolOptions = {}
  ): Promise<SymbolEdgeBackfillResult> {
    return this.backfillFromStoredHistory(symbol, lookbackDays, options);
  }

  async backfillFromStoredHistory(
    symbol: string,
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
    options: HydrateSymbolOptions = {}
  ): Promise<SymbolEdgeBackfillResult> {
    const sym = symbol.toUpperCase();
    const evaluatedDates = options.evaluatedSessionDates ?? [];

    if (options.forceFetch !== false) {
      options.onPhase?.('fetch');
      const ensure = await this.ensureSymbolHistoryReady(sym);
      if (!ensure.ok) {
        this.profileStore.updateStatus(sym, 'FAILED', ensure.message, ensure.message);
        return {
          recorded: 0,
          sessions: 0,
          totalSignals: 0,
          candlesStored: ensure.candleCount,
          historyStatus: 'ERROR',
          historyMessage: ensure.message,
          replayedDates: [],
          error: ensure.message
        };
      }
    }

    options.onPhase?.('snapshots', 'Loading replay snapshots…');
    const hydration = await this.incrementalHydration.hydrateSymbol(sym, lookbackDays, {
      evaluatedSessionDates: evaluatedDates,
      force: options.forceReplay ?? false,
      onPhase: (phase: HydrationCachePhase | 'fetch' | 'replay' | 'evaluate', detail?: string) =>
        options.onPhase?.(phase, detail)
    });

    let bulk = hydration.bulk;
    if (bulk.historyStatus === 'ERROR' || (!bulk.sessions.length && !hydration.cacheFirst)) {
      return this.backfillLegacy(sym, lookbackDays, evaluatedDates, options);
    }

    if (hydration.cacheFirst) {
      options.onPhase?.('validate', bulk.historyMessage ?? 'Cache hit');
    } else if (hydration.replayed > 0) {
      options.onPhase?.('stale-replay', bulk.historyMessage ?? 'Stale sessions replayed');
    }

    let sessionsToReplay = filterSessionsForReplay(bulk.sessions, evaluatedDates);
    if (!sessionsToReplay.length && bulk.sessions.length) {
      const fromTs = Date.now() - lookbackDays * 86_400_000;
      const evaluated = this.store.query({ symbol: sym, fromTs }).filter(s => s.evaluation?.status);
      if (!evaluated.length) {
        sessionsToReplay = bulk.sessions.filter(
          s => (s.timeline?.length ?? 0) > 0 && (s.sessionCandles?.length ?? 0) > 0
        );
      }
    }
    options.onPhase?.('evaluate', 'Evaluating signals…');
    const recorded = this.signalIntel.bootstrapBulkFromReplay(sessionsToReplay);
    const replayedDates = sessionsToReplay.map(s => s.replayDate).filter(Boolean);

    const deterministic = this.buildDeterministicSummary(sym, lookbackDays);
    this.profileStore.touchDeterministic(sym, deterministic, { historyLoadedAt: Date.now() });

    options.onPhase?.('enrich', 'Background enrichment…');
    this.lazyEnrichment.scheduleEnrichment(150);

    return {
      recorded,
      sessions: sessionsToReplay.length,
      totalSignals: bulk.totalSignals,
      candlesStored: bulk.candlesStored ?? 0,
      historyStatus: bulk.historyStatus ?? (bulk.sessionsProcessed > 0 ? 'READY' : 'NO_SESSIONS'),
      historyMessage: bulk.historyMessage ?? '',
      replayedDates
    };
  }

  /** Legacy fallback — direct bulk replay without cache (used if incremental path unavailable). */
  private async backfillLegacy(
    sym: string,
    lookbackDays: number,
    evaluatedDates: string[],
    options: HydrateSymbolOptions
  ): Promise<SymbolEdgeBackfillResult> {
    options.onPhase?.('replay', 'Replaying stale sessions…');
    const bulk = await firstValueFrom(
      this.replayService.loadBulkHistory(sym, lookbackDays).pipe(
        timeout(180_000),
        catchError(() =>
          of({
            symbol: sym,
            lookbackDays,
            sessionsProcessed: 0,
            sessionsWithSignals: 0,
            totalSignals: 0,
            candlesStored: 0,
            historyStatus: 'ERROR',
            historyMessage: 'Bulk replay request failed',
            sessions: []
          })
        )
      )
    );

    const sessionsToReplay = filterSessionsForReplay(bulk.sessions, evaluatedDates);
    options.onPhase?.('evaluate');
    const recorded = this.signalIntel.bootstrapBulkFromReplay(sessionsToReplay);
    const replayedDates = sessionsToReplay.map(s => s.replayDate).filter(Boolean);

    const deterministic = this.buildDeterministicSummary(sym, lookbackDays);
    this.profileStore.touchDeterministic(sym, deterministic, { historyLoadedAt: Date.now() });

    return {
      recorded,
      sessions: sessionsToReplay.length,
      totalSignals: bulk.totalSignals,
      candlesStored: bulk.candlesStored ?? 0,
      historyStatus: bulk.historyStatus ?? (bulk.sessionsProcessed > 0 ? 'READY' : 'NO_SESSIONS'),
      historyMessage: bulk.historyMessage ?? '',
      replayedDates
    };
  }

  buildDeterministicSummary(
    symbol: string,
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS
  ): SymbolEdgeCompressedSummary {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const filter: SignalIntelligenceFilter = { symbol: symbol.toUpperCase(), fromTs };
    const signals = this.store.query(filter);
    return buildSymbolEdgeSummary(symbol, signals, lookbackDays);
  }

  /**
   * Full symbol analysis with profile persistence and AI cache.
   * Skips Ollama when evaluated signal digest is unchanged unless forceRefresh.
   */
  async analyzeSymbol(
    symbol: string,
    options: AnalyzeSymbolOptions = {}
  ): Promise<SymbolEdgeProfile> {
    const sym = symbol.toUpperCase();
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const deterministic = this.buildDeterministicSummary(sym, lookbackDays);
    const digest = this.computeAnalysisDigest(sym, lookbackDays);
    const existing = this.profileStore.get(sym);

    if (!options.forceRefresh && existing?.analysisDigest === digest && existing.analysis) {
      this.profileStore.touchDeterministic(sym, deterministic);
      return this.profileStore.get(sym)!;
    }

    this.profileStore.updateStatus(sym, 'ANALYZING_AI', 'Generating AI edge summary…');

    let analysis: SymbolEdgeAnalysisResponse;
    if (deterministic.evaluatedTrades === 0) {
      analysis = this.localFallback(sym, lookbackDays, deterministic, [
        'No evaluated signals for this symbol in Signal Intelligence.',
        'Use Load 60D History to backfill from stored candles, then re-analyze.'
      ]);
    } else {
      analysis = await this.fetchAiAnalysis(sym, lookbackDays, deterministic);
    }

    return this.profileStore.upsertFromAnalysis(sym, deterministic, analysis, digest, 'READY', {
      statusMessage: `${deterministic.evaluatedTrades} evaluated signals`
    });
  }

  /** @deprecated Use analyzeSymbol — kept for backward compatibility. */
  async analyze(symbol: string, lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS): Promise<SymbolEdgeAnalysisResponse> {
    const profile = await this.analyzeSymbol(symbol);
    return profile.analysis ?? this.localFallback(
      symbol.toUpperCase(),
      lookbackDays,
      profile.deterministic,
      ['No analysis available.']
    );
  }

  getProfile(symbol: string): SymbolEdgeProfile | undefined {
    return this.profileStore.get(symbol);
  }

  getRankings(): SymbolEdgeRankingRow[] {
    return this.profileStore.getRankings();
  }

  computeAnalysisDigest(symbol: string, lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS): string {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ symbol: symbol.toUpperCase(), fromTs });
    const evaluated = signals.filter(s => s.evaluation?.status);
    const lastTs = evaluated.length ? Math.max(...evaluated.map(s => s.timestamp)) : 0;
    return `${evaluated.length}:${lastTs}:${this.store.revision()}`;
  }

  private async fetchAiAnalysis(
    sym: string,
    lookbackDays: number,
    deterministic: SymbolEdgeCompressedSummary
  ): Promise<SymbolEdgeAnalysisResponse> {
    try {
      return await firstValueFrom(
        this.http.post<SymbolEdgeAnalysisResponse>(`${this.base}/symbol-analysis/${sym}`, deterministic).pipe(
          timeout(AI_TIMEOUT_MS),
          catchError(() =>
            this.http.get<SymbolEdgeAnalysisResponse>(`${this.base}/symbol-analysis/${sym}`).pipe(
              timeout(AI_TIMEOUT_MS),
              catchError(() => of(this.localFallback(sym, lookbackDays, deterministic, ['AI service unavailable.'])))
            )
          )
        )
      );
    } catch {
      return this.localFallback(sym, lookbackDays, deterministic, ['AI request timed out — showing local stats only.']);
    }
  }

  private async ensureSymbolHistoryReady(
    symbol: string
  ): Promise<{ ok: boolean; message: string; candleCount: number }> {
    const status = await firstValueFrom(
      this.systemStatus.getStatus().pipe(
        catchError(() => of({ ibkrConnected: false } as SystemStatus))
      )
    );
    if (!status.ibkrConnected) {
      return {
        ok: false,
        message: 'IBKR not connected — start TWS/Gateway (port 7496 paper / 7497 live) then retry',
        candleCount: 0
      };
    }

    const deadline = Date.now() + HISTORY_MAX_WAIT_MS;
    while (Date.now() < deadline) {
      const sub = await firstValueFrom(
        this.symbolService.subscribe(symbol).pipe(
          catchError(() =>
            of({
              status: 'ERROR',
              candleCount: 0,
              message: 'Subscribe request failed'
            } as SymbolSubscribeResponse)
          )
        )
      );

      if (sub.status === 'ERROR') {
        return {
          ok: false,
          message: sub.message || 'Failed to load symbol history from IBKR',
          candleCount: sub.candleCount ?? 0
        };
      }

      if (sub.status === 'READY' && sub.candleCount >= 10) {
        return {
          ok: true,
          message: sub.message || `${symbol} ready (${sub.candleCount} bars)`,
          candleCount: sub.candleCount
        };
      }

      await new Promise(resolve => setTimeout(resolve, HISTORY_POLL_MS));
    }

    return {
      ok: false,
      message: `Timed out waiting for ${symbol} historical data from IBKR (${HISTORY_MAX_WAIT_MS / 1000}s)`,
      candleCount: 0
    };
  }

  private localFallback(
    symbol: string,
    lookbackDays: number,
    deterministic: SymbolEdgeCompressedSummary,
    warnings: string[]
  ): SymbolEdgeAnalysisResponse {
    const ai = this.buildLocalAi(deterministic);
    return {
      symbol,
      lookbackDays,
      dataSource: 'SIGNAL_INTELLIGENCE',
      aggregateConfidence: deterministic.overall.confidence,
      evaluatedTrades: deterministic.evaluatedTrades,
      deterministic,
      ai,
      provider: 'local',
      latencyMs: 0,
      fallbackUsed: true,
      warnings
    };
  }

  private buildLocalAi(data: SymbolEdgeCompressedSummary) {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const best: string[] = [];
    const avoid: string[] = [];
    const optimize: string[] = [];

    if (data.bestSetup && data.bestSetup.expectancy > 0) {
      strengths.push(`${data.bestSetup.type} strongest setup (+${data.bestSetup.expectancy.toFixed(2)}R, n=${data.bestSetup.sample})`);
      best.push(`${data.bestSetup.type} in favorable regime`);
    }
    if (data.worstSetup && data.worstSetup.expectancy < 0) {
      weaknesses.push(`${data.worstSetup.type} underperforms (${data.worstSetup.expectancy.toFixed(2)}R)`);
      avoid.push(`${data.worstSetup.type} without confirmation`);
    }
    if (data.worstRegime && data.worstRegime.expectancy < 0) {
      weaknesses.push(`${data.worstRegime.name} regime destroys expectancy (${data.worstRegime.expectancy.toFixed(2)}R)`);
      avoid.push(`Momentum entries during ${data.worstRegime.name}`);
      optimize.push(`Suppress breakout entries during ${data.worstRegime.name}`);
    }
    if (data.bestTimeWindow && data.bestTimeWindow !== '—') {
      strengths.push(`Best continuation window: ${data.bestTimeWindow}`);
    }
    if (data.lateEntryPenalty.expectancyDropPct > 15) {
      weaknesses.push(`Late entries reduce expectancy by ${Math.round(data.lateEntryPenalty.expectancyDropPct)}%`);
      optimize.push('Prioritize READY/TRIGGERED entries over ENTERED stage');
    }
    if (!strengths.length) {
      strengths.push('Insufficient evaluated history — collect more signal intelligence samples.');
    }
    if (!optimize.length) {
      optimize.push('Review setup×regime matrix before changing thresholds.');
    }

    return {
      ...EMPTY_AI,
      strengths,
      weaknesses,
      bestConditions: best,
      avoidConditions: avoid,
      optimizationSuggestions: optimize,
      confidence: data.overall.confidence,
      summary: `${data.symbol} — ${data.lookbackDays}-day deterministic edge analysis (local mode)`
    };
  }
}
