import { Injectable } from '@angular/core';
import { Candle } from '../../models/candle.model';
import { SetupCandidate } from '../../models/execution.model';
import { ReplayHistory, ReplaySignalEvent } from '../../models/replay.model';
import { ExecutionPlanService } from '../execution-plan/execution-plan.service';
import { ExecutionPlanModeService } from '../execution-plan/execution-plan-mode.service';
import {
  ExecutionPlan,
  HistoricalExecutionSnapshot
} from '../execution-plan/execution-plan.models';
import { HistoricalIndicatorSnapshotEngine } from './historical-indicator-snapshot.engine';
import { HistoricalRvolEngine } from './historical-rvol.engine';
import { HistoricalVwapEngine } from './historical-vwap.engine';
import { HistoricalConvictionEngine } from './historical-conviction.engine';
import { HistoricalLifecycleEngine } from './historical-lifecycle.engine';
import { HistoricalRegimeReconstructorEngine } from './historical-regime-reconstructor.engine';

export interface HistoricalPlanBuildInput {
  history: ReplayHistory;
  barIndex: number;
  symbol: string;
  signalType?: string;
  event?: ReplaySignalEvent | null;
}

/** Phase 174 — deterministic execution plan at replay cursor (no live state). */
@Injectable({ providedIn: 'root' })
export class HistoricalExecutionPlanEngine {
  constructor(
    private readonly planService: ExecutionPlanService,
    private readonly planMode: ExecutionPlanModeService
  ) {}
  private readonly indicators = new HistoricalIndicatorSnapshotEngine();
  private readonly vwap = new HistoricalVwapEngine();
  private readonly rvol = new HistoricalRvolEngine();
  private readonly conviction = new HistoricalConvictionEngine();
  private readonly lifecycle = new HistoricalLifecycleEngine();
  private readonly regime = new HistoricalRegimeReconstructorEngine();

  build(input: HistoricalPlanBuildInput): HistoricalExecutionSnapshot | null {
    const candles = input.history.sessionCandles;
    if (!candles.length || input.barIndex < 0 || input.barIndex >= candles.length) return null;

    const c = candles[input.barIndex];
    const price = c.close;
    const ind = this.indicators.build(candles, input.barIndex);
    if (!ind) return null;

    const event = input.event ?? this.eventAtBar(input.history, input.barIndex);
    const source: SetupCandidate = {
      symbol: input.symbol,
      signalType: input.signalType ?? event?.signalType ?? 'CONT_BUY',
      price,
      relativeVolume: ind.relativeVolume,
      extended: event?.extended ?? false,
      freshness: 'ACTIVE'
    };

    const planSource = this.planMode.useAutonomous() ? 'AUTONOMOUS_TEMPLATE' : 'HISTORICAL_RR';
    const { plan } = this.planService.buildExecutionPlan({
      source,
      price,
      indicators: ind,
      snapshot: null,
      extended: source.extended,
      planSource,
      replayTimestamp: c.time
    });

    if (!plan) return null;

    const regime = this.regime.fromSignal(event);
    const enriched: ExecutionPlan = {
      ...plan,
      source: planSource,
      canonicalRegime: regime,
      conviction: this.conviction.fromEvent(event),
      continuationPersistence: Math.round((event?.score ?? 50) * 0.85),
      expansionProbability: event?.score ?? 50,
      metadata: {
        ...plan.metadata,
        replayBarIndex: input.barIndex,
        replayTimestamp: c.time,
        historicalOnly: true
      }
    };

    const ts = new Date(c.time).getTime();

    return {
      timestamp: c.time,
      timestampMs: Number.isFinite(ts) ? ts : Date.now(),
      barIndex: input.barIndex,
      price,
      vwap: this.vwap.atBar(candles, input.barIndex),
      ema9: ind.ema9,
      ema20: ind.ema20,
      rvol: this.rvol.atBar(candles, input.barIndex),
      persistence: enriched.continuationPersistence ?? 0,
      conviction: enriched.conviction ?? 50,
      lifecycleState: this.lifecycle.fromEvent(event, source.extended),
      canonicalRegime: regime,
      executionPlan: enriched
    };
  }

  private eventAtBar(history: ReplayHistory, barIndex: number): ReplaySignalEvent | null {
    const bar = history.sessionCandles[barIndex];
    if (!bar) return null;
    const t = new Date(bar.time).getTime();
    let best: ReplaySignalEvent | null = null;
    let bestDt = Infinity;
    for (const e of history.timeline) {
      const et = new Date(e.timestamp).getTime();
      const dt = Math.abs(et - t);
      if (dt < bestDt) {
        bestDt = dt;
        best = e;
      }
    }
    return bestDt < 120_000 ? best : null;
  }
}
