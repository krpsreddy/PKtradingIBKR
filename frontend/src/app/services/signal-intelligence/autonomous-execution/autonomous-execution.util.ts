import { TradingSignal } from '../../../models/signal.model';
import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { AutonomousEntryType, AutonomousExecutionInput } from './autonomous-execution.models';

export function autonomousMarker(t: AutonomousEntryType): string {
  switch (t) {
    case 'CONTINUATION_ADD': return 'CONT ADD';
    case 'VWAP_ACCEPTANCE_CONTINUATION': return 'VWAP CONT';
    case 'SHALLOW_PULLBACK_CONTINUATION': return 'SHALLOW PB';
    case 'EARLY_EXPANSION_ENTRY': return 'EARLY EXP';
    case 'PERSISTENCE_ENTRY': return 'PERSISTENCE';
    case 'HIGH_RVOL_CONTINUATION': return 'RVOL CONT';
    case 'STRUCTURE_ACCELERATION_ENTRY': return 'STRUCT ACCEL';
  }
}

export function autonomousMarkerColor(): string {
  return '#a78bfa';
}

export function inputFromSignal(signal: TradingSignal, sampleCount = 0): AutonomousExecutionInput {
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

export function inputFromSnapshot(s: SignalSnapshot, n: number): AutonomousExecutionInput {
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
    sampleCount: n
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

export function isWaitOrSuppress(d: string): boolean {
  return d.includes('WAIT') || d.includes('AVOID') || d === 'REDUCE_SIZE';
}
