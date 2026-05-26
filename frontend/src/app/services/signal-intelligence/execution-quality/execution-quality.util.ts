import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { breadthBucket, entryQuality, timeWindow } from '../edge-discovery/edge-cluster-metrics.util';
import { windowAt } from '../trade-lifecycle/trade-lifecycle.util';
import { ExecutionQualityFeatureScores } from './execution-quality.models';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

export const MIN_AUTHORITATIVE_SAMPLE = 10;
export const MIN_LOW_CONFIDENCE_SAMPLE = 25;

export function extensionPct(s: SignalSnapshot): number {
  return Math.abs(s.vwapDistance ?? 0) * 100;
}

export function computeFeatureScores(s: SignalSnapshot): ExecutionQualityFeatureScores {
  const ext = extensionPct(s);
  const w5 = windowAt(s.evaluation, 5);
  const w15 = windowAt(s.evaluation, 15);
  const mae = s.evaluation?.maeR ?? 0;
  const mfe5 = w5?.mfeR ?? s.evaluation?.mfeR ?? 0;

  return {
    extensionPct: ext,
    vwapAligned: Math.abs(s.vwapDistance ?? 0) <= 0.012,
    breadthStrong: breadthBucket(s) === 'STRONG',
    continuationStrong: mfe5 >= 0.35 && (w15?.mfeR ?? mfe5) >= 0.5,
    pullbackStable: mae > -0.45,
    reclaimHeld: s.signalType === 'VWAP_RECLAIM' && mfe5 >= 0.15 && mae > -0.35,
    fakeoutElevated: falseBreakout.isFalseBreakout(s) || (mae < -0.5 && !(s.evaluation?.hit1R)),
    momentumAccelerating: (s.rvol ?? 0) >= 4 && ext >= 3,
    expansionLeg: estimateExpansionLeg(s),
    lateRelativeToImpulse: entryQuality(s) === 'LATE' || entryQuality(s) === 'CHASE' || !!s.extendedEntry
  };
}

export function estimateExpansionLeg(s: SignalSnapshot): number {
  let leg = 1;
  const ext = extensionPct(s);
  const rvol = s.rvol ?? 0;
  if (ext >= 3) leg++;
  if (ext >= 5) leg++;
  if (ext >= 8) leg++;
  if (rvol >= 5 && ext >= 4) leg++;
  if (s.extendedEntry && s.captureStage === 'ENTERED') leg++;
  return Math.min(4, leg);
}

export function isLiquiditySweep(s: SignalSnapshot, scores: ExecutionQualityFeatureScores): boolean {
  const mae = s.evaluation?.maeR ?? 0;
  const mfe = s.evaluation?.mfeR ?? 0;
  const wickDominant = mae < -0.55 && mfe < 0.4;
  const reclaimReject = s.signalType === 'VWAP_RECLAIM' && mae < -0.45 && !(s.evaluation?.hit1R);
  const stopHunt = wickDominant && (s.volatility ?? 0) > 0.02 && scores.fakeoutElevated;
  return stopHunt || reclaimReject;
}

export function isTrapRisk(s: SignalSnapshot, scores: ExecutionQualityFeatureScores): boolean {
  return (
    breadthBucket(s) === 'WEAK'
    && s.marketRegime === 'CHOP'
    && (scores.fakeoutElevated || scores.continuationStrong === false)
    && !scores.reclaimHeld
  );
}

export function isExhausted(s: SignalSnapshot, scores: ExecutionQualityFeatureScores): boolean {
  const decay = (s.evaluation?.mfeR ?? 0) > 0 && (windowAt(s.evaluation, 15)?.mfeR ?? 0) < (windowAt(s.evaluation, 5)?.mfeR ?? 0);
  return scores.expansionLeg >= 3 && (scores.momentumAccelerating || decay) && scores.extensionPct >= 5;
}

export function isStrongTrendContinuation(s: SignalSnapshot): boolean {
  return (
    s.signalType === 'TREND_CONTINUATION'
    && breadthBucket(s) === 'STRONG'
    && (s.trendAlignment ?? 0) >= 72
    && s.marketRegime === 'TREND'
  );
}

export function isChaseEntry(s: SignalSnapshot, scores: ExecutionQualityFeatureScores): boolean {
  if (isStrongTrendContinuation(s) && scores.breadthStrong && scores.continuationStrong) return false;
  if (entryQuality(s) === 'CHASE' || s.extendedEntry) return true;
  if (scores.lateRelativeToImpulse && scores.momentumAccelerating && scores.extensionPct >= 4) return true;
  if (scores.extensionPct >= 6 && (s.rvol ?? 0) >= 4.5) return true;
  return false;
}

export function isExtendedEntry(s: SignalSnapshot, scores: ExecutionQualityFeatureScores): boolean {
  return scores.extensionPct >= 5 || (scores.extensionPct >= 3 && scores.expansionLeg >= 2);
}

export function isReclaimConfirmed(s: SignalSnapshot, scores: ExecutionQualityFeatureScores): boolean {
  if (s.signalType !== 'VWAP_RECLAIM' && s.signalType !== 'BREAKOUT') return false;
  return scores.reclaimHeld && scores.pullbackStable && scores.continuationStrong;
}

export function isIdealEntry(s: SignalSnapshot, scores: ExecutionQualityFeatureScores): boolean {
  return (
    (scores.reclaimHeld || scores.continuationStrong)
    && scores.vwapAligned
    && scores.breadthStrong
    && scores.extensionPct < 3
    && scores.pullbackStable
    && !scores.fakeoutElevated
    && !scores.lateRelativeToImpulse
  );
}

export function isEarlyProbe(s: SignalSnapshot, scores: ExecutionQualityFeatureScores): boolean {
  const early = (s.sessionTimeMinutes ?? 999) <= 12 || s.captureStage === 'TRIGGERED';
  return early && !scores.reclaimHeld && !scores.continuationStrong && !scores.fakeoutElevated;
}

export function sessionCount(signals: SignalSnapshot[]): number {
  const days = new Set(signals.map(s => new Date(s.timestamp).toDateString()));
  return days.size;
}

export function symbolCount(signals: SignalSnapshot[]): number {
  return new Set(signals.map(s => s.symbol)).size;
}

export function meetsMultiValidation(signals: SignalSnapshot[]): boolean {
  return sessionCount(signals) >= 5 && symbolCount(signals) >= 3;
}

export function timingWindowLabel(s: SignalSnapshot): string {
  return timeWindow(s.sessionTimeMinutes ?? 0);
}

export function extensionBucketLabel(pct: number): string {
  if (pct < 2) return '<2%';
  if (pct < 5) return '2–5%';
  if (pct < 8) return '5–8%';
  return '>8%';
}
