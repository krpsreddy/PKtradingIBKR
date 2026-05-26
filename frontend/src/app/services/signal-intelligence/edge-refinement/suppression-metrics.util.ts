import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { avg, computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { SuppressionImprovementDeltas, SuppressionPerformanceMetrics } from './suppression-validation.models';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

export function computePerformanceMetrics(signals: SignalSnapshot[]): SuppressionPerformanceMetrics {
  const evaluated = evaluatedSignals(signals);
  if (!evaluated.length) return emptyMetrics();

  const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
  const hit1 = evaluated.filter(s => s.evaluation!.hit1R);
  const hit2 = evaluated.filter(s => s.evaluation!.hit2R);
  const falseOnes = evaluated.filter(s => falseBreakout.isFalseBreakout(s));
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
    drawdownR: computeDrawdownR(evaluated),
    continuationQuality: pct(contWins.length, evaluated.length),
    confidence: confidenceFromCount(evaluated.length)
  };
}

export function computeDeltas(
  baseline: SuppressionPerformanceMetrics,
  suppressed: SuppressionPerformanceMetrics,
  removed: SignalSnapshot[]
): SuppressionImprovementDeltas {
  const removedEval = evaluatedSignals(removed);
  const removedWinners = removedEval.filter(s => s.evaluation!.status === 'WIN');
  const removedHighR = removedWinners.filter(s => (s.evaluation!.mfeR ?? 0) >= 1.5);

  return {
    expectancyR: round2(suppressed.expectancyR - baseline.expectancyR),
    winRate: round2(suppressed.winRate - baseline.winRate),
    fakeoutRate: round2(suppressed.fakeoutRate - baseline.fakeoutRate),
    drawdownR: round2(suppressed.drawdownR - baseline.drawdownR),
    tradeCount: suppressed.sampleCount - baseline.sampleCount,
    tradeCountPct: baseline.sampleCount
      ? round2(((suppressed.sampleCount - baseline.sampleCount) / baseline.sampleCount) * 100)
      : 0,
    hit1RRate: round2(suppressed.hit1RRate - baseline.hit1RRate),
    hit2RRate: round2(suppressed.hit2RRate - baseline.hit2RRate),
    avgMfeR: round2(suppressed.avgMfeR - baseline.avgMfeR),
    avgMaeR: round2(suppressed.avgMaeR - baseline.avgMaeR),
    missedWinners: removedWinners.length,
    missedHighRTrades: removedHighR.length,
    missedExpectancyR: removedEval.length ? round2(computeExpectancyR(removedEval)) : 0
  };
}

export function computeDrawdownR(signals: SignalSnapshot[]): number {
  const sorted = [...signals].sort((a, b) => a.timestamp - b.timestamp);
  let cum = 0;
  let peak = 0;
  let maxDd = 0;
  for (const s of sorted) {
    cum += tradeR(s);
    peak = Math.max(peak, cum);
    maxDd = Math.max(maxDd, peak - cum);
  }
  return round2(maxDd);
}

export function computeSuppressionQualityScore(
  deltas: SuppressionImprovementDeltas,
  baseline: SuppressionPerformanceMetrics,
  overSuppressed: boolean
): number {
  if (baseline.sampleCount < 10) return 0;
  let score = 50;
  score += clamp(deltas.expectancyR * 45, -25, 30);
  score += clamp(-deltas.fakeoutRate * 0.35, -15, 18);
  score += clamp(deltas.drawdownR * -15, -10, 12);
  score += clamp(deltas.tradeCountPct * 0.15, -20, 8);
  if (deltas.expectancyR > 0.2) score += 8;
  if (deltas.fakeoutRate < -10) score += 6;
  if (overSuppressed) score -= 28;
  if (baseline.sampleCount >= 30) score += 5;
  return Math.round(clamp(score, 0, 100));
}

function tradeR(s: SignalSnapshot): number {
  const ev = s.evaluation!;
  if (ev.status === 'WIN') return ev.hit2R ? 2 : ev.hit1R ? 1 : Math.min(ev.mfeR, 1);
  if (ev.status === 'LOSS') return ev.maeR;
  return ev.mfeR * 0.35;
}

function emptyMetrics(): SuppressionPerformanceMetrics {
  return {
    sampleCount: 0, winRate: 0, expectancyR: 0, avgMfeR: 0, avgMaeR: 0,
    hit1RRate: 0, hit2RRate: 0, fakeoutRate: 0, drawdownR: 0, continuationQuality: 0,
    confidence: confidenceFromCount(0)
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
