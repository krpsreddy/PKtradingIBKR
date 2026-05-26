import {
  CaptureStage,
  IntelligenceSignalType,
  MarketRegime,
  SignalDirection,
  SignalSnapshot
} from '../../models/signal-intelligence.model';
import { ActiveSignal } from '../../models/workspace.model';
import { ExecutionSnapshot } from '../../models/refinement.model';
import { ReplaySignalEvent } from '../../models/replay.model';

export interface SnapshotBuildContext {
  symbol: string;
  captureStage: CaptureStage;
  timeframe?: string;
  direction?: SignalDirection;
  marketRegime?: MarketRegime;
  entryPrice?: number | null;
  stopPrice?: number | null;
  targetPrice?: number | null;
  riskReward?: number | null;
  convictionScore?: number | null;
  rvol?: number | null;
  trendAlignment?: number | null;
  vwapDistance?: number | null;
  emaAlignment?: boolean;
  signalType?: string | null;
  timestamp?: number | string | null;
}

let idCounter = 0;

export function buildSnapshotId(symbol: string, ts: number, stage: CaptureStage): string {
  idCounter += 1;
  return `${symbol}-${ts}-${stage}-${idCounter}`;
}

export function mapSourceSignalType(raw: string | null | undefined): IntelligenceSignalType {
  const t = (raw ?? '').toUpperCase();
  if (t.includes('PULL') || t.includes('VWAP') || t.includes('RECLAIM')) return 'VWAP_RECLAIM';
  if (t.includes('CONT')) return 'TREND_CONTINUATION';
  if (t.includes('FAIL') || t.includes('RECOVERY') || t.includes('REVERS')) return 'REVERSAL';
  if (t.includes('MOM') || t.includes('IMBALANCE')) return 'MOMENTUM';
  if (t.includes('OPEN') || t.includes('SCOUT') || t.includes('BREAK')) return 'BREAKOUT';
  return 'MOMENTUM';
}

export function mapMarketRegime(
  regime: string | null | undefined,
  intensityMode?: string | null
): MarketRegime {
  const r = (regime ?? '').toUpperCase();
  const mode = (intensityMode ?? '').toUpperCase();
  if (mode === 'EXITING' || mode === 'FAILURE') return 'EXITING';
  if (mode === 'CHOP') return 'CHOP';
  if (mode === 'BREAKOUT' || mode === 'TRIGGER') return 'BREAKOUT';
  if (mode === 'CALM') return 'CALM';
  if (r.includes('CHOP')) return 'CHOP';
  if (r.includes('BULL') || r.includes('BEAR') || r.includes('TREND') || r.includes('RISK')) return 'TREND';
  return 'CHOP';
}

export function inferDirection(signalType: string | null | undefined): SignalDirection {
  const t = (signalType ?? '').toUpperCase();
  if (t.includes('DOWN') || t.includes('BEAR') || t.includes('SHORT') || t.includes('FAIL')) {
    return 'SHORT';
  }
  return 'LONG';
}

export function buildSignalSnapshot(ctx: SnapshotBuildContext): SignalSnapshot | null {
  const entry = ctx.entryPrice ?? null;
  if (entry == null || entry <= 0) return null;

  const ts = normalizeTimestamp(ctx.timestamp) ?? Date.now();
  const sourceType = ctx.signalType ?? 'UNKNOWN';
  const stop = ctx.stopPrice ?? defaultStop(entry, inferDirection(sourceType));
  const intelType = mapSourceSignalType(sourceType);
  const vwapDist = ctx.vwapDistance ?? undefined;

  return {
    id: buildSnapshotId(ctx.symbol, ts, ctx.captureStage),
    symbol: ctx.symbol,
    timestamp: ts,
    timeframe: ctx.timeframe ?? '5MIN',
    direction: ctx.direction ?? inferDirection(sourceType),
    signalType: intelType,
    marketRegime: ctx.marketRegime ?? 'CHOP',
    entryPrice: entry,
    stopPrice: stop,
    targetPrice: ctx.targetPrice ?? undefined,
    riskReward: ctx.riskReward ?? computeRr(entry, stop, ctx.targetPrice),
    convictionScore: clampScore(ctx.convictionScore ?? 50),
    rvol: ctx.rvol ?? 1,
    trendAlignment: clampScore(ctx.trendAlignment ?? 50),
    vwapDistance: vwapDist,
    emaAlignment: ctx.emaAlignment,
    sessionTimeMinutes: sessionMinutesFromTimestamp(ts),
    volatility: estimateVolatility(entry, stop),
    extendedEntry: Math.abs(vwapDist ?? 0) >= 0.012,
    captureStage: ctx.captureStage,
    sourceSignalType: sourceType,
    createdAt: Date.now()
  };
}

export function snapshotFromActiveSignal(
  signal: ActiveSignal,
  ctx: Omit<SnapshotBuildContext, 'symbol' | 'signalType' | 'timestamp'> & {
    captureStage: CaptureStage;
    marketRegime?: MarketRegime;
    stopPrice?: number | null;
    targetPrice?: number | null;
    entryPrice?: number | null;
  }
): SignalSnapshot | null {
  return buildSignalSnapshot({
    symbol: signal.symbol,
    signalType: signal.signalType,
    timestamp: signal.timestamp,
    entryPrice: ctx.entryPrice ?? signal.price,
    stopPrice: ctx.stopPrice,
    targetPrice: ctx.targetPrice,
    riskReward: signal.estimatedRr,
    convictionScore: signal.confidenceScore ?? signal.tradeQualityScore,
    rvol: signal.relativeVolume,
    trendAlignment: signal.rankScore,
    captureStage: ctx.captureStage,
    marketRegime: ctx.marketRegime,
    timeframe: ctx.timeframe
  });
}

export function snapshotFromExecution(
  symbol: string,
  execution: ExecutionSnapshot,
  ctx: Omit<SnapshotBuildContext, 'symbol' | 'entryPrice' | 'stopPrice' | 'targetPrice' | 'riskReward'>
): SignalSnapshot | null {
  return buildSignalSnapshot({
    ...ctx,
    symbol,
    entryPrice: execution.entryPrice,
    stopPrice: execution.stopZone ?? execution.invalidationLevel,
    targetPrice: execution.targetPrice,
    riskReward: execution.estimatedRr,
    convictionScore: execution.tradeQualityScore
  });
}

export function snapshotFromReplayEvent(
  symbol: string,
  event: ReplaySignalEvent,
  ctx: { captureStage: CaptureStage; marketRegime?: MarketRegime; timeframe?: string }
): SignalSnapshot | null {
  const stop = defaultStop(event.price, inferDirection(event.signalType));
  return buildSignalSnapshot({
    symbol,
    signalType: event.signalType,
    timestamp: event.timestamp,
    entryPrice: event.price,
    stopPrice: stop,
    convictionScore: event.score,
    rvol: event.rvol,
    trendAlignment: event.score,
    vwapDistance: event.vwap != null && event.price > 0
      ? (event.price - event.vwap) / event.price
      : undefined,
    captureStage: ctx.captureStage,
    marketRegime: ctx.marketRegime,
    timeframe: ctx.timeframe
  });
}

function normalizeTimestamp(ts: number | string | null | undefined): number | null {
  if (ts == null) return null;
  if (typeof ts === 'number') return ts;
  const parsed = Date.parse(ts);
  return Number.isFinite(parsed) ? parsed : null;
}

function defaultStop(entry: number, direction: SignalDirection): number {
  const pct = 0.008;
  return direction === 'LONG' ? entry * (1 - pct) : entry * (1 + pct);
}

function computeRr(entry: number, stop: number, target?: number | null): number | undefined {
  if (target == null) return undefined;
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return undefined;
  return Math.abs(target - entry) / risk;
}

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Minutes from 9:30 ET — deterministic session clock for AI features. */
function sessionMinutesFromTimestamp(ts: number): number {
  const d = new Date(ts);
  const etOffset = -5;
  const utcH = d.getUTCHours();
  const utcM = d.getUTCMinutes();
  const etTotal = utcH * 60 + utcM + etOffset * 60;
  const open = 9 * 60 + 30;
  return Math.max(0, etTotal - open);
}

function estimateVolatility(entry: number, stop: number): number {
  if (entry <= 0) return 0;
  return Math.round((Math.abs(entry - stop) / entry) * 10000) / 100;
}
