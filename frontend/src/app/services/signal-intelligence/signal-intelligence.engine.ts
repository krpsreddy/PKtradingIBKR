import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Candle } from '../../models/candle.model';
import { CaptureStage, SignalSnapshot } from '../../models/signal-intelligence.model';
import { ExecutionState } from '../../models/execution-state.model';
import { ActiveSignal } from '../../models/workspace.model';
import { ExecutionSnapshot } from '../../models/refinement.model';
import { ReplayHistory } from '../../models/replay.model';
import { ExecutionStateService } from '../execution-state.service';
import { SignalEvaluationEngine } from './signal-evaluation.engine';
import { SignalIntelligenceStore } from './signal-intelligence.store';
import { SignalAnalyticsService } from './signal-analytics.service';
import {
  buildSignalSnapshot,
  mapMarketRegime,
  snapshotFromActiveSignal,
  snapshotFromExecution,
  snapshotFromReplayEvent
} from './signal-snapshot.factory';

const CAPTURE_STATES: ExecutionState[] = ['READY', 'TRIGGERED', 'MANAGING'];
const STAGE_BY_STATE: Record<string, CaptureStage> = {
  READY: 'READY',
  TRIGGERED: 'TRIGGERED',
  MANAGING: 'ENTERED'
};

export interface RecordContext {
  symbol: string;
  signalType?: string | null;
  marketRegime?: string | null;
  intensityMode?: string | null;
  timeframe?: string;
  entryPrice?: number | null;
  stopPrice?: number | null;
  targetPrice?: number | null;
  riskReward?: number | null;
  convictionScore?: number | null;
  rvol?: number | null;
  trendAlignment?: number | null;
  execution?: ExecutionSnapshot | null;
  activeSignal?: ActiveSignal | null;
}

@Injectable({ providedIn: 'root' })
export class SignalIntelligenceEngine implements OnDestroy {
  private readonly evaluator = new SignalEvaluationEngine();
  private readonly candleCache = new Map<string, { candles: Candle[]; fetchedAt: number }>();
  private stateSub?: Subscription;
  private lastState: ExecutionState = 'WATCHING';
  private lastRecordedSymbol: string | null = null;

  constructor(
    private store: SignalIntelligenceStore,
    private analytics: SignalAnalyticsService,
    private executionState: ExecutionStateService
  ) {
    this.stateSub = this.executionState.executionState$.subscribe(s => {
      this.onExecutionTransition(s.state, s.previous);
    });
  }

  ngOnDestroy(): void {
    this.stateSub?.unsubscribe();
  }

  /** Primary entry — capture snapshot at READY / TRIGGERED / ENTERED (MANAGING). */
  recordSignal(snapshot: SignalSnapshot): SignalSnapshot | null {
    if (!snapshot?.symbol || snapshot.entryPrice <= 0) return null;
    if (this.store.hasDuplicate(snapshot.symbol, snapshot.sourceSignalType ?? snapshot.signalType, snapshot.timestamp)) {
      return null;
    }
    this.store.upsert(snapshot);
    this.tryEvaluate(snapshot.id, snapshot.symbol);
    return snapshot;
  }

  recordFromContext(stage: CaptureStage, ctx: RecordContext): SignalSnapshot | null {
    const regime = mapMarketRegime(ctx.marketRegime, ctx.intensityMode);
    const fromExecution = ctx.execution
      ? snapshotFromExecution(ctx.symbol, ctx.execution, {
          captureStage: stage,
          signalType: ctx.signalType,
          marketRegime: regime,
          timeframe: ctx.timeframe,
          rvol: ctx.rvol,
          trendAlignment: ctx.trendAlignment
        })
      : null;

    const fromActive = !fromExecution && ctx.activeSignal
      ? snapshotFromActiveSignal(ctx.activeSignal, {
          captureStage: stage,
          marketRegime: regime,
          timeframe: ctx.timeframe,
          entryPrice: ctx.entryPrice,
          stopPrice: ctx.stopPrice,
          targetPrice: ctx.targetPrice
        })
      : null;

    const snapshot = fromExecution ?? fromActive ?? buildSignalSnapshot({
      symbol: ctx.symbol,
      captureStage: stage,
      signalType: ctx.signalType,
      marketRegime: regime,
      timeframe: ctx.timeframe,
      entryPrice: ctx.entryPrice,
      stopPrice: ctx.stopPrice,
      targetPrice: ctx.targetPrice,
      riskReward: ctx.riskReward,
      convictionScore: ctx.convictionScore,
      rvol: ctx.rvol,
      trendAlignment: ctx.trendAlignment
    });

    return snapshot ? this.recordSignal(snapshot) : null;
  }

  /** Evaluate open signals when candles are available — never uses future beyond supplied data. */
  evaluateOpenSignals(symbol: string, candles: Candle[], barDurationMinutes?: number): number {
    this.cacheCandles(symbol, candles);
    const open = this.store.query({ symbol }).filter(s =>
      !s.evaluation?.evaluated || s.evaluation.status === 'OPEN'
    );
    let evaluated = 0;
    for (const s of open) {
      if (this.evaluateSnapshot(s, candles, barDurationMinutes)) evaluated++;
    }
    return evaluated;
  }

  /** Bootstrap historical intelligence from replay session — deterministic, no leakage. */
  bootstrapFromReplay(history: ReplayHistory, intensityMode?: string | null): number {
    const regime = mapMarketRegime(null, intensityMode);
    let recorded = 0;
    for (const event of history.timeline) {
      const stage: CaptureStage = event.lifecycleState === 'READY' ? 'READY'
        : event.lifecycleState === 'NEW' ? 'TRIGGERED' : 'READY';
      const snap = snapshotFromReplayEvent(history.symbol, event, {
        captureStage: stage,
        marketRegime: regime,
        timeframe: history.timeframe
      });
      if (snap && this.recordSignal(snap)) {
        this.evaluateSnapshot(snap, history.sessionCandles);
        recorded++;
      }
    }
    this.analytics.refresh();
    return recorded;
  }

  /** Bulk backfill from multi-session replay payload (60-day lookback in one call). */
  bootstrapBulkFromReplay(sessions: ReplayHistory[], intensityMode?: string | null): number {
    this.store.beginBulkImport();
    try {
      const batch: SignalSnapshot[] = [];
      const dedupe = new Set<string>();

      for (const session of sessions) {
        if (!session.timeline?.length || !session.sessionCandles?.length) continue;
        const regime = mapMarketRegime(null, intensityMode);
        for (const event of session.timeline) {
          const stage: CaptureStage = event.lifecycleState === 'READY' ? 'READY'
            : event.lifecycleState === 'NEW' ? 'TRIGGERED' : 'READY';
          const snap = snapshotFromReplayEvent(session.symbol, event, {
            captureStage: stage,
            marketRegime: regime,
            timeframe: session.timeframe
          });
          if (!snap) continue;

          const dedupeKey = `${snap.symbol}:${snap.sourceSignalType ?? snap.signalType}:${snap.timestamp}`;
          if (dedupe.has(dedupeKey)) continue;
          if (this.store.hasDuplicate(snap.symbol, snap.sourceSignalType ?? snap.signalType, snap.timestamp)) {
            continue;
          }

          const evaluation = this.evaluator.evaluate({
            direction: snap.direction,
            entryPrice: snap.entryPrice,
            stopPrice: snap.stopPrice,
            targetPrice: snap.targetPrice,
            signalTimestamp: snap.timestamp,
            candles: session.sessionCandles
          });
          dedupe.add(dedupeKey);
          batch.push({ ...snap, evaluation });
        }
      }

      if (batch.length) {
        this.store.upsertMany(batch);
      }
      this.analytics.refresh();
      return batch.length;
    } finally {
      this.store.endBulkImport();
    }
  }

  ingestActiveSignals(
    signals: ActiveSignal[],
    ctx: Omit<RecordContext, 'symbol' | 'activeSignal'>
  ): number {
    let n = 0;
    for (const sig of signals) {
      const stage: CaptureStage =
        sig.lifecycleState === 'NEW' || sig.lifecycleState === 'ACTIVE' ? 'TRIGGERED' : 'READY';
      if (this.recordFromContext(stage, { ...ctx, symbol: sig.symbol, activeSignal: sig })) n++;
    }
    return n;
  }

  reevaluateAll(candlesBySymbol: Record<string, Candle[]>, barDurationMinutes?: number): void {
    for (const [symbol, candles] of Object.entries(candlesBySymbol)) {
      this.cacheCandles(symbol, candles);
      this.evaluateOpenSignals(symbol, candles, barDurationMinutes);
    }
    this.analytics.refresh();
  }

  getStore(): SignalIntelligenceStore {
    return this.store;
  }

  private onExecutionTransition(state: ExecutionState, previous: ExecutionState | null): void {
    if (!CAPTURE_STATES.includes(state)) return;
    if (state === previous) return;
    this.lastState = state;
  }

  /** Called by dashboard when symbol context is refreshed. */
  onSymbolContext(
    ctx: RecordContext,
    candles: Candle[],
    executionState: ExecutionState
  ): void {
    if (CAPTURE_STATES.includes(executionState)) {
      const stage = STAGE_BY_STATE[executionState] ?? 'READY';
      const shouldRecord = !(ctx.symbol === this.lastRecordedSymbol && executionState === this.lastState);
      if (shouldRecord) {
        const recorded = this.recordFromContext(stage, ctx);
        if (recorded) {
          this.lastRecordedSymbol = ctx.symbol;
          this.lastState = executionState;
        }
      }
    }
    this.cacheCandles(ctx.symbol, candles);
    this.evaluateOpenSignals(ctx.symbol, candles);
  }

  private tryEvaluate(id: string, symbol: string): void {
    const snap = this.store.get(id);
    if (!snap) return;
    const cached = this.candleCache.get(symbol);
    if (cached?.candles.length) {
      this.evaluateSnapshot(snap, cached.candles);
    }
  }

  private evaluateSnapshot(
    snap: SignalSnapshot,
    candles: Candle[],
    barDurationMinutes?: number
  ): boolean {
    const evaluation = this.evaluator.evaluate({
      direction: snap.direction,
      entryPrice: snap.entryPrice,
      stopPrice: snap.stopPrice,
      targetPrice: snap.targetPrice,
      signalTimestamp: snap.timestamp,
      candles,
      barDurationMinutes
    });

    if (evaluation.status === 'OPEN' && snap.evaluation?.evaluated) {
      return false;
    }

    this.store.updateEvaluation(snap.id, evaluation);
    return evaluation.evaluated;
  }

  private cacheCandles(symbol: string, candles: Candle[]): void {
    this.candleCache.set(symbol, { candles, fetchedAt: Date.now() });
  }
}
