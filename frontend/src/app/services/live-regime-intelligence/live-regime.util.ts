import { TradingSignal } from '../../models/signal.model';
import { SignalSnapshot } from '../../models/signal-intelligence.model';
import { LiveRegimeInput, LiveRegimeType, LiveRegimeClassification } from './live-regime.models';

export const CONTINUATION_WINDOW_START = 5;
export const CONTINUATION_WINDOW_END = 90;

export function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function inContinuationWindow(minutes?: number): boolean {
  if (minutes == null) return true;
  return minutes >= CONTINUATION_WINDOW_START && minutes <= CONTINUATION_WINDOW_END;
}

export function windowLabel(minutes?: number): string {
  if (minutes == null) return 'session';
  if (minutes <= 15) return '9:35–9:45 opening continuation';
  if (minutes <= 45) return '9:45–10:15 early expansion';
  if (minutes <= 90) return '10:15–11:00 persistence window';
  return 'midday';
}

export function inputFromSignal(signal: TradingSignal, sampleCount = 0): LiveRegimeInput {
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
    breadthAlignment: signal.confidenceScore ?? undefined,
    sampleCount
  };
}

export function inputFromSnapshot(s: SignalSnapshot, sampleCount: number): LiveRegimeInput {
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
    breadthAlignment: s.trendAlignment,
    continuationQuality: s.trendAlignment,
    sampleCount
  };
}

export function regimeMarker(type: LiveRegimeType | LiveRegimeClassification): string {
  switch (type) {
    case 'EXPLOSIVE_CONTINUATION': return 'EXPLOSIVE';
    case 'EARLY_ACCELERATION': return 'ACCEL';
    case 'INSTITUTIONAL_PERSISTENCE': return 'INST PERSIST';
    case 'SHALLOW_PULLBACK_CONTINUATION': return 'SHALLOW PB';
    case 'VWAP_ACCEPTANCE_PERSISTENCE': return 'VWAP HOLD';
    case 'TREND_COMPRESSION_RELEASE': return 'COMPRESS';
    case 'LATE_EXHAUSTION': return 'EXHAUST';
    case 'RETAIL_CHASE_EXHAUSTION': return 'CHASE RISK';
    case 'CHOP_INSTABILITY': return 'CHOP';
    case 'PERSISTENT_TREND': return 'PERSIST';
    case 'HEALTHY_PULLBACK': return 'HEALTHY PB';
    case 'REACCELERATION_READY': return 'REACCEL';
    case 'EXTENDED_BUT_HEALTHY': return 'EXT HEALTHY';
    case 'LATE_STAGE_EXHAUSTION': return 'LATE EXH';
    case 'CHOP_UNSTABLE': return 'UNSTABLE';
  }
}

export function regimeMarkerColor(classification: LiveRegimeClassification): string {
  switch (classification) {
    case 'EXPLOSIVE_CONTINUATION':
    case 'PERSISTENT_TREND':
    case 'REACCELERATION_READY':
      return '#34d399';
    case 'HEALTHY_PULLBACK':
    case 'EXTENDED_BUT_HEALTHY':
      return '#6ee7b7';
    case 'LATE_STAGE_EXHAUSTION':
      return '#f87171';
    case 'CHOP_UNSTABLE':
      return '#94a3b8';
  }
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
