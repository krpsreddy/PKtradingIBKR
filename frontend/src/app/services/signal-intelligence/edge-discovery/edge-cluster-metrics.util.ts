import {
  EdgeClassificationState,
  EdgeScoreBand,
  ConditionClusterMetrics
} from './edge-discovery.models';
import { ConfidenceRating, SignalSnapshot } from '../../../models/signal-intelligence.model';
import { avg, computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';

const falseBreakoutEngine = new FalseBreakoutAnalyticsEngine();

export const MIN_CLUSTER_SAMPLE = 5;

export function rvolBucket(rvol: number): string {
  if (rvol < 1.5) return '<1.5';
  if (rvol < 3) return '1.5–3';
  if (rvol < 5) return '3–5';
  return '>5';
}

export function timeWindow(m: number): string {
  if (m < 15) return '9:30–9:45';
  if (m < 45) return '9:45–10:15';
  if (m < 90) return '10:15–11:00';
  return '11:00+';
}

export function premarketBucket(s: SignalSnapshot): string {
  const pctExt = Math.abs(s.vwapDistance ?? 0) * 100;
  if (pctExt < 2) return '<2%';
  if (pctExt < 5) return '2–5%';
  if (pctExt < 8) return '5–8%';
  return '>8%';
}

export function entryQuality(s: SignalSnapshot): string {
  if (s.extendedEntry && s.captureStage === 'ENTERED') return 'CHASE';
  if (s.captureStage === 'ENTERED') return 'LATE';
  if (s.captureStage === 'TRIGGERED') return 'GOOD';
  return 'IDEAL';
}

export function breadthBucket(s: SignalSnapshot): string {
  const t = s.trendAlignment ?? 50;
  if (t >= 70) return 'STRONG';
  if (t >= 50) return 'MID';
  return 'WEAK';
}

export function computeClusterMetrics(signals: SignalSnapshot[]): ConditionClusterMetrics {
  const evaluated = evaluatedSignals(signals);
  const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
  const losses = evaluated.filter(s => s.evaluation!.status === 'LOSS');
  const hit1 = evaluated.filter(s => s.evaluation!.hit1R);
  const hit2 = evaluated.filter(s => s.evaluation!.hit2R);
  const falseOnes = evaluated.filter(s => falseBreakoutEngine.isFalseBreakout(s));
  const lossTimes = losses.map(s => s.evaluation!.durationMinutes).filter(v => v > 0);
  const contWins = wins.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);

  return {
    sampleCount: evaluated.length,
    winRate: pct(wins.length, evaluated.length),
    expectancyR: computeExpectancyR(signals),
    avgMfeR: avg(evaluated.map(s => s.evaluation!.mfeR)),
    avgMaeR: avg(evaluated.map(s => s.evaluation!.maeR)),
    hit1RRate: pct(hit1.length, evaluated.length),
    hit2RRate: pct(hit2.length, evaluated.length),
    fakeoutRate: pct(falseOnes.length, evaluated.length),
    avgTimeToFailureMin: avg(lossTimes),
    continuationPersistence: evaluated.length ? pct(contWins.length, evaluated.length) : 0,
    confidence: confidenceFromCount(evaluated.length)
  };
}

export function classifyEdgeState(m: ConditionClusterMetrics): EdgeClassificationState {
  if (m.sampleCount < MIN_CLUSTER_SAMPLE) return 'NEUTRAL';
  if (m.expectancyR <= -0.2 && m.sampleCount >= 10) return 'TOXIC';
  if (m.fakeoutRate >= 50 && m.expectancyR < 0 && m.sampleCount >= 8) return 'TOXIC';
  if (m.expectancyR > 0.2 && m.winRate >= 55 && m.sampleCount >= 15) return 'HIGH_EDGE';
  if (m.expectancyR > 0.08 && m.sampleCount >= 10) return 'MODERATE_EDGE';
  if (m.expectancyR < -0.15 && m.sampleCount >= 5) return 'NO_EDGE';
  if (m.expectancyR < -0.05 && m.sampleCount >= 5) return 'WEAK_EDGE';
  return 'NEUTRAL';
}

export function computeAdaptiveEdgeScore(m: ConditionClusterMetrics, stability = 0.5): number {
  if (m.sampleCount < MIN_CLUSTER_SAMPLE) return 0;

  const expScore = clamp((m.expectancyR + 0.5) * 25, 0, 25);
  const sampleScore = clamp((Math.min(m.sampleCount, 50) / 50) * 15, 0, 15);
  const fakeoutScore = clamp((1 - m.fakeoutRate / 100) * 15, 0, 15);
  const contScore = clamp(m.continuationPersistence * 0.1, 0, 10);
  const maeScore = clamp((1 - Math.abs(m.avgMaeR) / 1.2) * 10, 0, 10);
  const wrScore = clamp(m.winRate * 0.1, 0, 10);
  const stabScore = clamp(stability * 10, 0, 10);
  const breadthScore = 5;

  return Math.round(clamp(expScore + sampleScore + fakeoutScore + contScore + maeScore + wrScore + stabScore + breadthScore, 0, 100));
}

export function edgeScoreBand(score: number): EdgeScoreBand {
  if (score >= 80) return 'AGGRESSIVE';
  if (score >= 65) return 'FAVORABLE';
  if (score >= 50) return 'SELECTIVE';
  if (score >= 35) return 'REDUCE_SIZE';
  return 'NO_EDGE';
}

export function heatmapTone(sample: number, exp: number, wr: number): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'INSUFFICIENT' {
  if (sample < MIN_CLUSTER_SAMPLE) return 'INSUFFICIENT';
  if (exp > 0.1 && wr >= 50) return 'POSITIVE';
  if (exp < -0.1 && wr <= 48) return 'NEGATIVE';
  return 'NEUTRAL';
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
