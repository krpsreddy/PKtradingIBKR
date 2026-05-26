import { TradingSignal } from '../../../models/signal.model';
import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { LiveExecutionDecision } from '../live-decision/live-decision.models';
import {
  ContinuationParticipationInput,
  ContinuationParticipationSignalType,
  ParticipationConfidenceTier
} from './continuation-participation.models';

export const MIN_AUTHORITATIVE = 10;
export const MIN_LOW_CONFIDENCE = 25;

export function confidenceTier(n: number): ParticipationConfidenceTier {
  if (n < MIN_AUTHORITATIVE) return 'INSUFFICIENT';
  if (n < MIN_LOW_CONFIDENCE) return 'LOW';
  if (n < 50) return 'MODERATE';
  return 'HIGH';
}

export function isWaitOrSuppress(d: LiveExecutionDecision): boolean {
  return d.includes('WAIT') || d.includes('AVOID') || d === 'REDUCE_SIZE';
}

export function participationMarker(t: ContinuationParticipationSignalType): string {
  switch (t) {
    case 'CONTINUATION_ADD': return 'CONT ADD';
    case 'EARLY_EXPANSION_ENTRY': return 'EARLY EXP';
    case 'VWAP_ACCEPTANCE_CONTINUATION': return 'VWAP CONT';
    case 'SHALLOW_PULLBACK_CONTINUATION': return 'SHALLOW PB';
    case 'HIGH_RVOL_CONTINUATION': return 'RVOL CONT';
    case 'PERSISTENCE_ENTRY': return 'PERSISTENCE';
  }
}

export function participationMarkerColor(): string {
  return '#22d3ee';
}

export function participationLabel(t: ContinuationParticipationSignalType): string {
  return t.replace(/_/g, ' ');
}

export function inputFromSignal(signal: TradingSignal, sampleCount = 0): ContinuationParticipationInput {
  return {
    symbol: (signal.symbol ?? 'UNK').toUpperCase(),
    signalType: signal.signalType,
    sessionTimeMinutes: sessionMinutesFromTs(signal.timestamp),
    rvol: signal.relativeVolume ?? undefined,
    vwapDistance: signal.vwap != null && signal.price
      ? (signal.price - signal.vwap) / signal.price
      : undefined,
    trendAlignment: signal.confidenceScore ?? undefined,
    extended: signal.extended,
    convictionScore: signal.confidenceScore ?? undefined,
    sampleCount
  };
}

export function inputFromSnapshot(s: SignalSnapshot, sampleCount: number): ContinuationParticipationInput {
  return {
    symbol: s.symbol,
    signalType: s.sourceSignalType ?? s.signalType,
    sessionTimeMinutes: s.sessionTimeMinutes,
    rvol: s.rvol,
    vwapDistance: s.vwapDistance,
    trendAlignment: s.trendAlignment,
    extended: s.extendedEntry,
    convictionScore: s.convictionScore,
    volatility: s.volatility,
    sampleCount
  };
}

function sessionMinutesFromTs(ts: string): number | undefined {
  const parsed = Date.parse(ts);
  if (!Number.isFinite(parsed)) return undefined;
  const d = new Date(parsed);
  const et = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return et.getHours() * 60 + et.getMinutes() - 9 * 60 - 30;
}

export function mfeR(s: SignalSnapshot): number {
  return s.evaluation?.mfeR ?? 0;
}

export function sessionDateFromTs(ts: number): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}
