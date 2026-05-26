import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { LiveDecisionContext, LiveExecutionDecision, ConvictionBand } from '../live-decision/live-decision.models';
import { LiveDecisionEngine } from '../live-decision/live-decision-engine';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { EntryAcceptanceSequencingEngine } from '../entry-sequencing/entry-acceptance-sequencing.engine';
import { ContinuationAcceptanceEngine } from '../entry-sequencing/continuation-acceptance.engine';
import { PullbackStabilityEngine } from '../entry-sequencing/pullback-stability.engine';
import { MarketStateMachineEngine } from '../market-state/market-state-machine.engine';
import { TradeCalibrationMetrics } from './adaptive-calibration.models';

export const MIN_AUTHORITATIVE = 10;
export const MIN_LOW_CONFIDENCE = 25;

const decisionEngine = new LiveDecisionEngine();
const falseBreakout = new FalseBreakoutAnalyticsEngine();
const sequencer = new EntryAcceptanceSequencingEngine();
const continuationEngine = new ContinuationAcceptanceEngine();
const pullbackEngine = new PullbackStabilityEngine();
const marketStateMachine = new MarketStateMachineEngine();

/** Expected R targets by conviction band — calibration reference curve. */
export const EXPECTED_R_BY_BAND: Record<ConvictionBand, number> = {
  ELITE: 2.5,
  HIGH: 2.1,
  MODERATE: 0.8,
  LOW: 0.3,
  AVOID: -0.2
};

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

export function decisionForSignal(s: SignalSnapshot, sampleCount: number) {
  return decisionEngine.decide(contextFromSignal(s, sampleCount));
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

export function continuationAchieved(s: SignalSnapshot): boolean {
  return (s.evaluation?.mfeR ?? 0) >= 1 || s.evaluation?.hit1R === true;
}

export function narrativeStability(s: SignalSnapshot): number {
  const path = marketStateMachine.path(s);
  const states = path.states;
  if (states.length <= 1) return 50;
  const unique = new Set(states).size;
  const reversals = path.transitions.filter(t => t.quality === 'WEAK').length;
  return Math.max(0, Math.min(100, 100 - unique * 8 - reversals * 12));
}

export function expansionCapturePct(s: SignalSnapshot): number {
  const mfe = s.evaluation?.mfeR ?? 0;
  if (mfe <= 0) return 0;
  const target = Math.max(1, mfe);
  const realized = realizedR(s);
  if (realized <= 0) return Math.round(Math.min(40, mfe * 25));
  return Math.round(Math.min(100, (realized / target) * 100));
}

export function isAvoidDecision(d: LiveExecutionDecision): boolean {
  return d === 'AVOID_TRADE' || d === 'AVOID_CHASE' || d === 'TRAP_RISK';
}

export function isWaitDecision(d: LiveExecutionDecision): boolean {
  return d.includes('WAIT');
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function tradeCalibrationMetrics(s: SignalSnapshot, sampleCount: number): TradeCalibrationMetrics {
  const snap = decisionForSignal(s, sampleCount);
  const band = snap.conviction.band;
  const actual = realizedR(s);
  const expected = EXPECTED_R_BY_BAND[band];
  const delta = actual - expected;

  let convictionAccuracy = 'INSUFFICIENT';
  if (Math.abs(delta) <= 0.4) convictionAccuracy = 'ALIGNED';
  else if (delta < -0.4) convictionAccuracy = 'OVERSTATED';
  else convictionAccuracy = 'UNDERSTATED';

  const waitEfficiency = isWaitDecision(snap.decision)
    ? (s.evaluation?.status === 'WIN' ? 'WAIT_COSTLY' : 'WAIT_HELPFUL')
    : (isFakeout(s) ? 'ACT_TOO_EARLY' : 'ACT_EFFICIENT');

  let suppressionRegret = 'NONE';
  if (isAvoidDecision(snap.decision) && s.evaluation?.status === 'WIN') {
    suppressionRegret = 'FALSE_AVOID';
  } else if (snap.decision === 'TRAP_RISK' && !isFakeout(s) && s.evaluation?.status === 'WIN') {
    suppressionRegret = 'UNSAFE_TRAP';
  } else if (isAvoidDecision(snap.decision) && s.evaluation?.status === 'LOSS') {
    suppressionRegret = 'SAFE_SUPPRESS';
  }

  return {
    convictionAccuracy,
    waitEfficiency,
    expansionCapturedPct: expansionCapturePct(s),
    suppressionRegret
  };
}
