import { TradingSignal } from '../../models/signal.model';
import { SignalSnapshot } from '../../models/signal-intelligence.model';
import {
  ChartTriggerZone,
  ExecutionTriggerEntryType,
  ExecutionTriggerInput,
  RiskLevel,
  TraderExecutionAction
} from './execution-trigger.models';

export function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function windowLabel(minutes?: number): string {
  if (minutes == null) return 'session';
  if (minutes <= 15) return '9:35–10:15 opening continuation';
  if (minutes <= 45) return '10:15–11:00 shallow pullback persistence';
  if (minutes <= 120) return 'midday compression release';
  return 'trend resumption after digestion';
}

export function riskFromScore(score: number): RiskLevel {
  if (score >= 70) return 'LOW';
  if (score >= 55) return 'MODERATE';
  if (score >= 40) return 'ELEVATED';
  return 'HIGH';
}

export function qualityLabel(score: number): string {
  if (score >= 75) return 'STRONG';
  if (score >= 58) return 'SOLID';
  if (score >= 45) return 'MODERATE';
  return 'WEAK';
}

export function inputFromSignal(signal: TradingSignal, sampleCount = 0): ExecutionTriggerInput {
  const vwapDist = signal.vwap != null && signal.price
    ? (signal.price - signal.vwap) / signal.price
    : undefined;
  return {
    symbol: (signal.symbol ?? 'UNK').toUpperCase(),
    signalType: signal.signalType,
    sessionTimeMinutes: sessionMinutesFromTs(signal.timestamp),
    rvol: signal.relativeVolume ?? undefined,
    vwapDistance: vwapDist,
    trendAlignment: signal.confidenceScore ?? undefined,
    extended: signal.extended,
    structureScore: signal.confidenceScore ?? undefined,
    pullbackDepth: vwapDist != null ? Math.abs(vwapDist) : undefined,
    price: signal.price,
    vwap: signal.vwap ?? undefined,
    sampleCount
  };
}

export function inputFromSnapshot(s: SignalSnapshot, sampleCount: number): ExecutionTriggerInput {
  return {
    symbol: s.symbol,
    signalType: s.sourceSignalType ?? s.signalType,
    marketRegime: s.marketRegime,
    sessionTimeMinutes: s.sessionTimeMinutes,
    rvol: s.rvol,
    vwapDistance: s.vwapDistance,
    trendAlignment: s.trendAlignment,
    extended: s.extendedEntry,
    structureScore: s.convictionScore ?? s.trendAlignment,
    volatility: s.volatility,
    pullbackDepth: s.vwapDistance != null ? Math.abs(s.vwapDistance) : undefined,
    price: s.entryPrice,
    sampleCount
  };
}

export function idealEntryZone(price?: number, vwapDist?: number): { low: number; high: number; label: string } | null {
  if (!price || price <= 0) return null;
  const band = Math.max(0.0015, Math.abs(vwapDist ?? 0.008) * 0.6);
  const low = round2(price * (1 - band));
  const high = round2(price * (1 + band * 0.5));
  return { low, high, label: `${low.toFixed(2)}–${high.toFixed(2)}` };
}

export function vwapPersistenceMinutes(input: ExecutionTriggerInput): number {
  const mins = input.sessionTimeMinutes ?? 0;
  const vwap = input.vwapDistance ?? 0;
  if (vwap >= 0 && mins > 5) return Math.min(120, Math.round(mins * 0.85));
  return Math.max(0, Math.round(mins * 0.4));
}

export function triggerMarker(entryType: ExecutionTriggerEntryType): string {
  switch (entryType) {
    case 'DIRECT_CONTINUATION_ENTRY': return 'CONT ENTRY';
    case 'SHALLOW_PULLBACK_ENTRY': return 'SHALLOW PB';
    case 'VWAP_PERSISTENCE_ENTRY': return 'VWAP HOLD';
    case 'MICRO_COMPRESSION_BREAKOUT': return 'COMPRESS';
    case 'ORB_CONTINUATION_ADD': return 'ORB ADD';
    case 'ACCELERATION_RECLAIM': return 'RECLAIM';
    case 'TREND_RESUMPTION_ENTRY': return 'RESUME';
  }
}

export function triggerMarkerColor(zone: ChartTriggerZone): string {
  switch (zone) {
    case 'CONTINUATION_ENTRY': return '#34d399';
    case 'SHALLOW_PULLBACK_HOLD': return '#fbbf24';
    case 'COMPRESSION_BREAKOUT': return '#60a5fa';
    case 'VWAP_PERSISTENCE': return '#a78bfa';
    case 'EXTENSION_WARNING': return '#fb923c';
    case 'EXHAUSTION_DEVELOPING': return '#f87171';
  }
}

export function actionLabel(action: TraderExecutionAction): string {
  return action.replace(/_/g, ' ');
}

function sessionMinutesFromTs(ts: string): number | undefined {
  const parsed = Date.parse(ts);
  if (!Number.isFinite(parsed)) return undefined;
  const d = new Date(parsed);
  const et = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return et.getHours() * 60 + et.getMinutes() - 9 * 60 - 30;
}

export function sessionDateFromTs(ts: number): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}
