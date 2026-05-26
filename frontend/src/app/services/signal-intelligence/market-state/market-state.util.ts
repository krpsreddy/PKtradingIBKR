import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { breadthBucket, entryQuality } from '../edge-discovery/edge-cluster-metrics.util';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { deriveStateSequence } from '../entry-sequencing/entry-sequencing.util';
import { extensionPct, isLiquiditySweepPattern, isRejected, windows, w } from '../entry-sequencing/entry-sequencing.util';
import {
  InstitutionalFlowType,
  LiveMarketStateInput,
  MarketState,
  NarrativeTrajectory
} from './market-state.models';

export const MIN_AUTHORITATIVE = 10;
export const MIN_LOW_CONFIDENCE = 25;

const falseBreakout = new FalseBreakoutAnalyticsEngine();

export function stateLabel(s: MarketState | string): string {
  return s.replace(/_/g, ' ');
}

export function dedupeStates(states: MarketState[]): MarketState[] {
  const out: MarketState[] = [];
  for (const s of states) {
    if (out[out.length - 1] !== s) out.push(s);
  }
  return out;
}

/** Derive ordered market-state path from evaluation windows + entry sequencing. */
export function deriveMarketStateSequence(s: SignalSnapshot): MarketState[] {
  const seq: MarketState[] = [];
  const mins = s.sessionTimeMinutes ?? 999;
  const { w5, w15, w30 } = windows(s);
  const m5 = w(w5);
  const m15 = w(w15);
  const ext = extensionPct(s);
  const ev = s.evaluation;
  const entrySeq = deriveStateSequence(s);

  if (mins < 25 && ['MOMENTUM', 'BREAKOUT', 'OPEN_MOM_BUY', 'MOM_BUY'].includes(s.signalType)) {
    seq.push('OPENING_DRIVE');
  }

  if (isLiquiditySweepPattern(s)) {
    seq.push('LIQUIDITY_SWEEP');
    if (ev?.status === 'LOSS') seq.push('TRAP_REVERSAL');
    return dedupeStates(seq);
  }

  if (ext >= 5 || entryQuality(s) === 'CHASE' || entrySeq.includes('EARLY_EXTENSION')) {
    seq.push('EARLY_EXTENSION');
  }

  if (falseBreakout.isFalseBreakout(s) || (m5.mfe < 0.2 && m5.mae < -0.35 && s.signalType === 'BREAKOUT')) {
    seq.push('FAILED_BREAKOUT');
  }

  if ((s.rvol ?? 1) < 1.2 && m15.mfe < 0.4) seq.push('RANGE_COMPRESSION');

  if (entrySeq.includes('PULLBACK_STABILIZING') || (m5.mae > -0.45 && m15.mfe >= m5.mfe && m5.mae < 0)) {
    seq.push('PULLBACK_STABILIZATION');
  }

  if (s.signalType === 'VWAP_RECLAIM' || entrySeq.includes('RECLAIM_IN_PROGRESS') || entrySeq.includes('RECLAIM_CONFIRMED')) {
    seq.push('VWAP_RECLAIM');
  }

  if (entrySeq.includes('RECLAIM_CONFIRMED') || entrySeq.includes('CONTINUATION_ACCEPTED') || m15.mfe >= 0.45) {
    seq.push('ACCEPTANCE');
  }

  if (entrySeq.includes('SECOND_LEG_CONFIRMED') || ev?.hit2R || m15.mfe >= 1) {
    seq.push('SECOND_LEG_CONTINUATION');
  }

  if (ev?.hit1R || m15.mfe >= 0.8 || (w30 && w(w30).mfe >= 1)) {
    seq.push('TREND_EXPANSION');
  }

  if (entrySeq.includes('EXHAUSTING') || entrySeq.includes('OVEREXTENDED') || (m15.mfe < m5.mfe && m5.mfe > 0.3)) {
    seq.push('EXHAUSTION');
  }

  if (entrySeq.includes('FAILED_ACCEPTANCE') || (ev?.status === 'LOSS' && m15.mfe < 0.3)) {
    seq.push('FAILED_ACCEPTANCE');
  }

  if (s.signalType === 'REVERSAL' || isRejected(s)) seq.push('TRAP_REVERSAL');

  if (s.extendedEntry || mins > 150 || ext >= 8) seq.push('LATE_CHASE_ENVIRONMENT');

  if (!seq.length) seq.push('RANGE_COMPRESSION');
  return dedupeStates(seq);
}

export function finalMarketState(states: MarketState[]): MarketState {
  const priority: MarketState[] = [
    'SECOND_LEG_CONTINUATION', 'TREND_EXPANSION', 'ACCEPTANCE', 'VWAP_RECLAIM',
    'PULLBACK_STABILIZATION', 'OPENING_DRIVE', 'EARLY_EXTENSION', 'EXHAUSTION',
    'FAILED_ACCEPTANCE', 'FAILED_BREAKOUT', 'LIQUIDITY_SWEEP', 'TRAP_REVERSAL',
    'LATE_CHASE_ENVIRONMENT', 'RANGE_COMPRESSION'
  ];
  for (const p of priority) {
    if (states.includes(p)) return p;
  }
  return states[states.length - 1] ?? 'RANGE_COMPRESSION';
}

export function deriveLiveMarketStateSequence(input: LiveMarketStateInput): MarketState[] {
  const seq: MarketState[] = [];
  const mins = input.sessionTimeMinutes ?? 999;
  const ext = Math.abs(input.vwapDistance ?? 0) * 100;
  const seqState = input.sequencingState ?? '';

  if (mins < 25 && ['MOMENTUM', 'BREAKOUT', 'OPEN_MOM_BUY', 'MOM_BUY'].includes(input.signalType ?? '')) {
    seq.push('OPENING_DRIVE');
  }
  if (ext >= 5 || input.extended || (input.entryQuality ?? '').includes('CHASE')) seq.push('EARLY_EXTENSION');
  if (input.fakeoutRisk === 'HIGH' || input.fakeoutRisk === 'EXTREME') seq.push('FAILED_BREAKOUT');
  if (seqState.includes('PULLBACK')) seq.push('PULLBACK_STABILIZATION');
  if (input.signalType === 'VWAP_RECLAIM' || seqState.includes('RECLAIM')) seq.push('VWAP_RECLAIM');
  if (seqState.includes('CONTINUATION') || seqState.includes('RECLAIM_CONFIRMED')) seq.push('ACCEPTANCE');
  if (seqState.includes('SECOND_LEG')) seq.push('SECOND_LEG_CONTINUATION');
  if (seqState.includes('EXHAUSTING') || seqState.includes('OVEREXTENDED')) seq.push('EXHAUSTION');
  if (seqState.includes('FAILED') || seqState.includes('REJECTED')) seq.push('FAILED_ACCEPTANCE');
  if (seqState.includes('LIQUIDITY_SWEEP')) seq.push('LIQUIDITY_SWEEP');
  if (input.signalType === 'REVERSAL') seq.push('TRAP_REVERSAL');
  if (input.extended || mins > 150) seq.push('LATE_CHASE_ENVIRONMENT');
  if ((input.rvol ?? 1) < 1.2) seq.push('RANGE_COMPRESSION');

  if (!seq.length) seq.push('OPENING_DRIVE');
  return dedupeStates(seq);
}

export function inferTrajectory(states: MarketState[]): NarrativeTrajectory {
  const current = finalMarketState(states);
  const positive: MarketState[] = ['ACCEPTANCE', 'SECOND_LEG_CONTINUATION', 'TREND_EXPANSION', 'VWAP_RECLAIM', 'PULLBACK_STABILIZATION'];
  const negative: MarketState[] = ['FAILED_BREAKOUT', 'FAILED_ACCEPTANCE', 'TRAP_REVERSAL', 'LIQUIDITY_SWEEP', 'EXHAUSTION', 'LATE_CHASE_ENVIRONMENT'];

  if (negative.includes(current)) {
    if (current === 'EXHAUSTION' || current === 'LATE_CHASE_ENVIRONMENT') return 'NARRATIVE_EXHAUSTED';
    return 'NARRATIVE_FAILING';
  }
  if (positive.includes(current)) {
    const hadFailure = states.some(s => negative.includes(s));
    if (hadFailure) return 'NARRATIVE_IMPROVING';
    return 'NARRATIVE_STABLE';
  }
  if (states.length >= 3 && positive.some(p => states.includes(p))) return 'NARRATIVE_IMPROVING';
  return 'NARRATIVE_STABLE';
}

export function trajectoryLabel(t: NarrativeTrajectory): string {
  switch (t) {
    case 'NARRATIVE_IMPROVING': return 'Narrative improving';
    case 'NARRATIVE_STABLE': return 'Narrative stable';
    case 'NARRATIVE_FAILING': return 'Narrative failing';
    case 'NARRATIVE_EXHAUSTED': return 'Narrative exhausted';
  }
}

export function pathKey(states: MarketState[]): string {
  return states.join('→');
}

export function inferInstitutionalFlow(s: SignalSnapshot, states: MarketState[]): InstitutionalFlowType {
  const current = finalMarketState(states);
  if (current === 'LIQUIDITY_SWEEP' || current === 'TRAP_REVERSAL') return 'LIQUIDITY_TRAP';
  if (current === 'LATE_CHASE_ENVIRONMENT' || entryQuality(s) === 'CHASE') return 'MOMENTUM_CHASING';
  if (current === 'EXHAUSTION' && (s.evaluation?.mfeR ?? 0) > 0.5) return 'DISTRIBUTION';
  if (['ACCEPTANCE', 'SECOND_LEG_CONTINUATION', 'TREND_EXPANSION'].includes(current)) return 'TREND_ACCEPTANCE';
  if (current === 'PULLBACK_STABILIZATION' || current === 'VWAP_RECLAIM') return 'ABSORPTION';
  if (breadthBucket(s) === 'STRONG' && (s.evaluation?.mfeR ?? 0) >= 0.5) return 'ACCUMULATION';
  return 'ABSORPTION';
}

export function inferLiveInstitutionalFlow(input: LiveMarketStateInput, states: MarketState[]): InstitutionalFlowType {
  const current = finalMarketState(states);
  if (current === 'LIQUIDITY_SWEEP' || current === 'TRAP_REVERSAL') return 'LIQUIDITY_TRAP';
  if (current === 'LATE_CHASE_ENVIRONMENT') return 'MOMENTUM_CHASING';
  if (current === 'EXHAUSTION') return 'DISTRIBUTION';
  if (['ACCEPTANCE', 'SECOND_LEG_CONTINUATION', 'TREND_EXPANSION'].includes(current)) return 'TREND_ACCEPTANCE';
  if (current === 'PULLBACK_STABILIZATION' || current === 'VWAP_RECLAIM') return 'ABSORPTION';
  if ((input.trendAlignment ?? 0) >= 70) return 'ACCUMULATION';
  return 'ABSORPTION';
}

export function flowLabel(f: InstitutionalFlowType): string {
  return f.replace(/_/g, ' ');
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
