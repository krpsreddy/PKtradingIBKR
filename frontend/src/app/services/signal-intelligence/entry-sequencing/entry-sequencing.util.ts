import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { EvaluationWindowResult } from '../../../models/signal-intelligence.model';
import { windowAt } from '../trade-lifecycle/trade-lifecycle.util';
import { breadthBucket, entryQuality } from '../edge-discovery/edge-cluster-metrics.util';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { EntryAcceptanceState } from './entry-sequencing.models';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

export const MIN_AUTHORITATIVE_SAMPLE = 10;
export const MIN_LOW_CONFIDENCE_SAMPLE = 25;

export function extensionPct(s: SignalSnapshot): number {
  return Math.abs(s.vwapDistance ?? 0) * 100;
}

export function w(w: EvaluationWindowResult | undefined): { mfe: number; mae: number } {
  return { mfe: w?.mfeR ?? 0, mae: w?.maeR ?? 0 };
}

export function windows(s: SignalSnapshot) {
  const ev = s.evaluation;
  return {
    w5: windowAt(ev, 5),
    w15: windowAt(ev, 15),
    w30: windowAt(ev, 30),
    w60: windowAt(ev, 60)
  };
}

export function isLiquiditySweepPattern(s: SignalSnapshot): boolean {
  const ev = s.evaluation;
  if (!ev) return false;
  return ev.maeR < -0.55 && ev.mfeR < 0.35 && (s.volatility ?? 0) > 0.015;
}

export function isRejected(s: SignalSnapshot): boolean {
  const ev = s.evaluation;
  return !!ev?.stoppedOut && ev.barsHeld <= 8 && ev.status === 'LOSS';
}

export function sessionCount(signals: SignalSnapshot[]): number {
  return new Set(signals.map(s => new Date(s.timestamp).toDateString())).size;
}

export function symbolCount(signals: SignalSnapshot[]): number {
  return new Set(signals.map(s => s.symbol)).size;
}

export function meetsMultiValidation(signals: SignalSnapshot[]): boolean {
  return sessionCount(signals) >= 5 && symbolCount(signals) >= 3;
}

export function rvolBucket(rvol: number): string {
  if (rvol < 1.5) return '<1.5';
  if (rvol < 3) return '1.5–3';
  if (rvol < 5) return '3–5';
  return '>5';
}

/** Derive ordered acceptance states from evaluation window progression. */
export function deriveStateSequence(s: SignalSnapshot): EntryAcceptanceState[] {
  const seq: EntryAcceptanceState[] = ['INITIAL_TRIGGER'];
  const { w5, w15, w30 } = windows(s);
  const m5 = w(w5);
  const m15 = w(w15);
  const ext = extensionPct(s);
  const ev = s.evaluation;

  if (isLiquiditySweepPattern(s)) {
    seq.push('LIQUIDITY_SWEEP');
    if (ev?.status === 'LOSS') seq.push('REJECTED');
    return dedupeSeq(seq);
  }

  if (ext >= 5 || entryQuality(s) === 'CHASE') seq.push('EARLY_EXTENSION');
  if (m5.mfe >= 0.25 && m5.mae > -0.35 && ext < 4) seq.push('EARLY_EXTENSION');

  if (s.signalType === 'VWAP_RECLAIM' || s.signalType === 'BREAKOUT') {
    if (m5.mae < -0.3 && m5.mfe < 0.2) seq.push('RECLAIM_IN_PROGRESS');
    if (m5.mfe >= 0.15 && m5.mae > -0.4) seq.push('RECLAIM_CONFIRMED');
  }

  if (m5.mfe < 0.25 && m5.mae > -0.5 && !seq.includes('RECLAIM_CONFIRMED')) {
    seq.push('WAITING_FOR_ACCEPTANCE');
  }

  if (m5.mae > -0.45 && m15.mfe >= m5.mfe && m5.mae < 0) seq.push('PULLBACK_STABILIZING');

  if (m15.mfe >= 0.45 && m15.mae > -0.45) seq.push('CONTINUATION_ACCEPTED');
  if (ev?.hit2R || m15.mfe >= 1 || (w30 && w(w30).mfe >= 1.2)) seq.push('SECOND_LEG_CONFIRMED');

  if (ext >= 6) seq.push('OVEREXTENDED');
  if (m15.mfe < m5.mfe && m5.mfe > 0.3) seq.push('EXHAUSTING');

  if (falseBreakout.isFalseBreakout(s) || (ev?.status === 'LOSS' && m15.mfe < 0.3)) {
    seq.push('FAILED_ACCEPTANCE');
  }
  if (isRejected(s)) seq.push('REJECTED');

  return dedupeSeq(seq);
}

export function finalState(states: EntryAcceptanceState[]): EntryAcceptanceState {
  const priority: EntryAcceptanceState[] = [
    'SECOND_LEG_CONFIRMED', 'CONTINUATION_ACCEPTED', 'RECLAIM_CONFIRMED', 'PULLBACK_STABILIZING',
    'RECLAIM_IN_PROGRESS', 'WAITING_FOR_ACCEPTANCE', 'EARLY_EXTENSION', 'OVEREXTENDED',
    'EXHAUSTING', 'FAILED_ACCEPTANCE', 'LIQUIDITY_SWEEP', 'REJECTED', 'INITIAL_TRIGGER'
  ];
  for (const p of priority) {
    if (states.includes(p)) return p;
  }
  return states[states.length - 1] ?? 'INITIAL_TRIGGER';
}

export function pathImproved(states: EntryAcceptanceState[]): boolean {
  const bad: EntryAcceptanceState[] = ['INITIAL_TRIGGER', 'EARLY_EXTENSION', 'WAITING_FOR_ACCEPTANCE', 'RECLAIM_IN_PROGRESS'];
  const good: EntryAcceptanceState[] = ['RECLAIM_CONFIRMED', 'CONTINUATION_ACCEPTED', 'SECOND_LEG_CONFIRMED', 'PULLBACK_STABILIZING'];
  return bad.some(b => states.includes(b)) && good.some(g => states.includes(g));
}

export function pathDegraded(states: EntryAcceptanceState[]): boolean {
  const good: EntryAcceptanceState[] = ['CONTINUATION_ACCEPTED', 'SECOND_LEG_CONFIRMED', 'RECLAIM_CONFIRMED'];
  const bad: EntryAcceptanceState[] = ['EXHAUSTING', 'FAILED_ACCEPTANCE', 'LIQUIDITY_SWEEP', 'REJECTED'];
  return good.some(g => states.includes(g)) && bad.some(b => states.includes(b));
}

export function pathLabel(states: EntryAcceptanceState[]): string {
  return states.map(s => s.replace(/_/g, ' ')).join(' → ');
}

function dedupeSeq(seq: EntryAcceptanceState[]): EntryAcceptanceState[] {
  const out: EntryAcceptanceState[] = [];
  for (const s of seq) {
    if (out[out.length - 1] !== s) out.push(s);
  }
  return out;
}

export function breadthLabel(s: SignalSnapshot): string {
  return breadthBucket(s);
}
