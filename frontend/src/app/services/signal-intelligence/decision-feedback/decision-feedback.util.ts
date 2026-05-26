import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { LiveDecisionContext, LiveExecutionDecision } from '../live-decision/live-decision.models';
import { breadthBucket } from '../edge-discovery/edge-cluster-metrics.util';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { EntryAcceptanceSequencingEngine } from '../entry-sequencing/entry-acceptance-sequencing.engine';
import { ContinuationAcceptanceEngine } from '../entry-sequencing/continuation-acceptance.engine';
import { PullbackStabilityEngine } from '../entry-sequencing/pullback-stability.engine';
import { DecisionReliabilityGroup } from './decision-feedback.models';

export const MIN_AUTHORITATIVE = 10;
export const MIN_LOW_CONFIDENCE = 25;

const falseBreakout = new FalseBreakoutAnalyticsEngine();
const sequencer = new EntryAcceptanceSequencingEngine();
const continuationEngine = new ContinuationAcceptanceEngine();
const pullbackEngine = new PullbackStabilityEngine();

export function contextFromSignal(s: SignalSnapshot, sampleCount: number): LiveDecisionContext {
  const seq = sequencer.sequence(s, sampleCount);
  return {
    symbol: s.symbol,
    signalType: s.signalType,
    marketRegime: s.marketRegime,
    rvol: s.rvol,
    trendAlignment: s.trendAlignment,
    vwapDistance: s.vwapDistance,
    sessionTimeMinutes: s.sessionTimeMinutes,
    extended: s.extendedEntry,
    entryQuality: s.captureStage,
    sequencingState: seq.finalState,
    continuationAcceptance: continuationEngine.classify(s),
    pullbackStability: pullbackEngine.classify(s),
    fakeoutRisk: falseBreakout.isFalseBreakout(s) ? 'HIGH' : 'LOW',
    sampleCount
  };
}

export function breadthLabel(s: SignalSnapshot): string {
  const b = breadthBucket(s);
  if (b) return b;
  const ta = s.trendAlignment ?? 0;
  if (ta >= 70) return 'STRONG';
  if (ta >= 50) return 'MODERATE';
  return 'WEAK';
}

export function realizedR(s: SignalSnapshot): number {
  const ev = s.evaluation!;
  if (ev.status === 'WIN') return ev.mfeR;
  if (ev.status === 'LOSS') return -Math.abs(ev.maeR);
  return 0;
}

export function isFakeout(s: SignalSnapshot): boolean {
  return falseBreakout.isFalseBreakout(s);
}

export function isDecisionCorrect(decision: LiveExecutionDecision, s: SignalSnapshot): boolean {
  const status = s.evaluation!.status;
  const mfe = s.evaluation!.mfeR;
  const fake = isFakeout(s);

  switch (decision) {
    case 'FULL_EXECUTION':
    case 'PROBING_EXECUTION':
      return status === 'WIN' || mfe >= 1;
    case 'WAIT_FOR_ACCEPTANCE':
    case 'WAIT_FOR_PULLBACK':
      return fake || status === 'LOSS' || mfe < 0.8;
    case 'REDUCE_SIZE':
      return status !== 'WIN' || mfe < 1.5 || fake;
    case 'AVOID_TRADE':
    case 'AVOID_CHASE':
    case 'TRAP_RISK':
      return status === 'LOSS' || fake || mfe < 0.5;
    default:
      return status === 'WIN';
  }
}

export function reliabilityGroup(decision: LiveExecutionDecision): DecisionReliabilityGroup {
  if (decision === 'FULL_EXECUTION' || decision === 'PROBING_EXECUTION') return 'FULL_EXECUTION';
  if (decision.includes('WAIT')) return 'WAIT';
  if (decision === 'REDUCE_SIZE') return 'REDUCE';
  if (decision === 'TRAP_RISK') return 'TRAP_RISK';
  return 'AVOID';
}

export function contextKey(s: SignalSnapshot): string {
  return [
    s.signalType ?? 'UNKNOWN',
    s.marketRegime ?? 'UNKNOWN',
    breadthLabel(s),
    s.extendedEntry ? 'EXT' : 'NORM'
  ].join('|');
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
