import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { entryQuality } from '../edge-discovery/edge-cluster-metrics.util';
import { deriveStateSequence, extensionPct, windows, w } from '../entry-sequencing/entry-sequencing.util';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { deriveMarketStateSequence } from '../market-state/market-state.util';
import {
  EntryLocationType,
  EntryStyle,
  EntryWindow,
  InstitutionalTimingPattern,
  LiveAdaptiveEntryInput
} from './adaptive-entry.models';

export const MIN_AUTHORITATIVE = 10;
export const MIN_LOW_CONFIDENCE = 25;

const falseBreakout = new FalseBreakoutAnalyticsEngine();

export const ENTRY_WINDOW_LABELS: Record<EntryWindow, string> = {
  INSTANT_RECLAIM: 'Instant Reclaim',
  RECLAIM_HOLD: 'Reclaim Hold',
  PULLBACK_STABILIZATION: 'Pullback Stabilization',
  SECOND_LEG_TRIGGER: 'Second Leg Trigger',
  POST_ACCEPTANCE_CONTINUATION: 'Post-Acceptance Continuation',
  INSTANT_BREAKOUT: 'Instant Breakout',
  FIRST_PUSH: 'First Push Breakout'
};

export const ENTRY_LOCATION_LABELS: Record<EntryLocationType, string> = {
  IDEAL_LOCATION: 'Ideal Location',
  EARLY_ACCEPTANCE: 'Early Acceptance',
  LATE_ACCEPTANCE: 'Late Acceptance',
  EXTENDED_LOCATION: 'Extended Location',
  EXHAUSTED_LOCATION: 'Exhausted Location',
  TRAP_LOCATION: 'Trap Location',
  INSTITUTIONAL_LOCATION: 'Institutional Location'
};

export function classifyEntryWindow(s: SignalSnapshot): EntryWindow {
  const seq = deriveStateSequence(s);
  const { w5, w15 } = windows(s);
  const m15 = w(w15);

  if (seq.includes('SECOND_LEG_CONFIRMED') || m15.mfe >= 1) return 'SECOND_LEG_TRIGGER';
  if (seq.includes('PULLBACK_STABILIZING')) return 'PULLBACK_STABILIZATION';
  if (seq.includes('CONTINUATION_ACCEPTED')) return 'POST_ACCEPTANCE_CONTINUATION';
  if (seq.includes('RECLAIM_CONFIRMED')) return 'RECLAIM_HOLD';
  if (seq.includes('RECLAIM_IN_PROGRESS') || s.signalType === 'VWAP_RECLAIM') return 'INSTANT_RECLAIM';
  if (seq.includes('EARLY_EXTENSION') && (s.sessionTimeMinutes ?? 999) < 20) return 'FIRST_PUSH';
  return 'INSTANT_BREAKOUT';
}

export function classifyEntryLocation(s: SignalSnapshot): EntryLocationType {
  const seq = deriveStateSequence(s);
  const ext = extensionPct(s);
  const eq = entryQuality(s);
  const ev = s.evaluation;

  if (falseBreakout.isFalseBreakout(s) || seq.includes('LIQUIDITY_SWEEP') || seq.includes('REJECTED')) {
    return 'TRAP_LOCATION';
  }
  if (seq.includes('EXHAUSTING') || seq.includes('OVEREXTENDED') || (ev?.mfeR ?? 0) > 0 && ev?.status === 'LOSS') {
    return 'EXHAUSTED_LOCATION';
  }
  if (ext >= 7 || eq === 'CHASE' || s.extendedEntry) return 'EXTENDED_LOCATION';
  if (seq.includes('SECOND_LEG_CONFIRMED') || (seq.includes('RECLAIM_CONFIRMED') && ext < 4)) {
    return 'INSTITUTIONAL_LOCATION';
  }
  if (seq.includes('RECLAIM_CONFIRMED') && ext < 3) return 'IDEAL_LOCATION';
  if (seq.includes('CONTINUATION_ACCEPTED') && ext >= 4) return 'LATE_ACCEPTANCE';
  if (seq.includes('WAITING_FOR_ACCEPTANCE') || seq.includes('RECLAIM_IN_PROGRESS')) return 'EARLY_ACCEPTANCE';
  if (ext >= 5) return 'LATE_ACCEPTANCE';
  return 'EARLY_ACCEPTANCE';
}

export function entryStyle(window: EntryWindow): EntryStyle {
  if (['INSTANT_RECLAIM', 'INSTANT_BREAKOUT', 'FIRST_PUSH'].includes(window)) return 'AGGRESSIVE';
  return 'PATIENT';
}

export function classifyLiveEntryWindow(input: LiveAdaptiveEntryInput): EntryWindow {
  const seq = input.sequencingState ?? '';
  const ext = Math.abs(input.vwapDistance ?? 0) * 100;

  if (seq.includes('SECOND_LEG')) return 'SECOND_LEG_TRIGGER';
  if (seq.includes('PULLBACK')) return 'PULLBACK_STABILIZATION';
  if (seq.includes('CONTINUATION')) return 'POST_ACCEPTANCE_CONTINUATION';
  if (seq.includes('RECLAIM_CONFIRMED')) return 'RECLAIM_HOLD';
  if (input.signalType === 'VWAP_RECLAIM' || seq.includes('RECLAIM')) return 'INSTANT_RECLAIM';
  if (ext >= 5 && (input.sessionTimeMinutes ?? 999) < 20) return 'FIRST_PUSH';
  return 'INSTANT_BREAKOUT';
}

export function classifyLiveEntryLocation(input: LiveAdaptiveEntryInput): EntryLocationType {
  const seq = input.sequencingState ?? '';
  const ext = Math.abs(input.vwapDistance ?? 0) * 100;
  const eq = (input.entryQuality ?? '').toUpperCase();

  if (input.extended || eq.includes('TRAP') || seq.includes('LIQUIDITY') || seq.includes('FAILED')) {
    return 'TRAP_LOCATION';
  }
  if (seq.includes('EXHAUSTING') || seq.includes('OVEREXTENDED')) return 'EXHAUSTED_LOCATION';
  if (ext >= 7 || input.extended || eq.includes('CHASE')) return 'EXTENDED_LOCATION';
  if (seq.includes('SECOND_LEG') || (seq.includes('RECLAIM_CONFIRMED') && ext < 4)) {
    return 'INSTITUTIONAL_LOCATION';
  }
  if (seq.includes('RECLAIM_CONFIRMED') && ext < 3) return 'IDEAL_LOCATION';
  if (ext >= 5) return 'LATE_ACCEPTANCE';
  if (seq.includes('RECLAIM') || seq.includes('ACCEPTANCE')) return 'EARLY_ACCEPTANCE';
  return 'EARLY_ACCEPTANCE';
}

export function inferInstitutionalTiming(s: SignalSnapshot): InstitutionalTimingPattern | null {
  const seq = deriveStateSequence(s);
  const states = deriveMarketStateSequence(s);
  const window = classifyEntryWindow(s);

  if (window === 'PULLBACK_STABILIZATION') return 'ABSORPTION_PULLBACK';
  if (window === 'SECOND_LEG_TRIGGER') return 'SECOND_LEG_ACCEPTANCE';
  if (window === 'RECLAIM_HOLD') return 'RECLAIM_HOLD';
  if (states.includes('OPENING_DRIVE') && seq.includes('FAILED_ACCEPTANCE')) return 'OPEN_DRIVE_TRAP';
  if (window === 'POST_ACCEPTANCE_CONTINUATION') return 'POST_ACCEPTANCE_CONTINUATION';
  return null;
}

export function narrativeCapturePct(s: SignalSnapshot, entryMfeR: number): number {
  const maxMfe = s.evaluation?.mfeR ?? 0;
  if (maxMfe <= 0) return 0;
  return Math.round(Math.min(100, (entryMfeR / maxMfe) * 100));
}

export function entryMfeProxy(s: SignalSnapshot, window: EntryWindow): number {
  const { w5, w15, w30 } = windows(s);
  switch (window) {
    case 'INSTANT_RECLAIM':
    case 'INSTANT_BREAKOUT':
    case 'FIRST_PUSH':
      return w(w5).mfe;
    case 'RECLAIM_HOLD':
    case 'PULLBACK_STABILIZATION':
      return w(w15).mfe;
    case 'SECOND_LEG_TRIGGER':
    case 'POST_ACCEPTANCE_CONTINUATION':
      return w(w30 ?? w15).mfe;
    default:
      return w(w5).mfe;
  }
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function locationGuidance(location: EntryLocationType): string {
  switch (location) {
    case 'IDEAL_LOCATION': return 'IDEAL RECLAIM LOCATION';
    case 'INSTITUTIONAL_LOCATION': return 'SECOND LEG ENTRY OPTIMAL';
    case 'EARLY_ACCEPTANCE': return 'EARLY ACCEPTANCE — MONITOR HOLD';
    case 'LATE_ACCEPTANCE': return 'LATE ACCEPTANCE — REDUCED EDGE';
    case 'EXTENDED_LOCATION': return 'EXTENDED ENTRY — POOR LOCATION';
    case 'EXHAUSTED_LOCATION': return 'EXHAUSTED LOCATION — AVOID';
    case 'TRAP_LOCATION': return 'TRAP LOCATION — DO NOT ENTER';
  }
}

export function isIdealLocation(location: EntryLocationType): boolean {
  return location === 'IDEAL_LOCATION' || location === 'INSTITUTIONAL_LOCATION';
}

export function isPoorLocation(location: EntryLocationType): boolean {
  return location === 'EXTENDED_LOCATION' || location === 'EXHAUSTED_LOCATION' || location === 'TRAP_LOCATION';
}
