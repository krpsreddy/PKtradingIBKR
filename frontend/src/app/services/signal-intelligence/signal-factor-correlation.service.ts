import { Injectable } from '@angular/core';
import {
  FactorCorrelationRow,
  SignalSnapshot
} from '../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from './signal-intelligence.math';

interface FactorBucket {
  factor: string;
  bucket: string;
  match: (s: SignalSnapshot) => boolean;
}

const BUCKETS: FactorBucket[] = [
  { factor: 'RVOL', bucket: '> 3.0', match: s => s.rvol > 3 },
  { factor: 'RVOL', bucket: '2.0 – 3.0', match: s => s.rvol >= 2 && s.rvol <= 3 },
  { factor: 'RVOL', bucket: '1.5 – 2.0', match: s => s.rvol >= 1.5 && s.rvol < 2 },
  { factor: 'RVOL', bucket: '< 1.5', match: s => s.rvol < 1.5 },
  { factor: 'CONVICTION', bucket: '≥ 70', match: s => s.convictionScore >= 70 },
  { factor: 'CONVICTION', bucket: '50 – 69', match: s => s.convictionScore >= 50 && s.convictionScore < 70 },
  { factor: 'CONVICTION', bucket: '< 50', match: s => s.convictionScore < 50 },
  { factor: 'TREND ALIGN', bucket: '≥ 80', match: s => s.trendAlignment >= 80 },
  { factor: 'TREND ALIGN', bucket: '50 – 79', match: s => s.trendAlignment >= 50 && s.trendAlignment < 80 },
  { factor: 'TREND ALIGN', bucket: '< 50', match: s => s.trendAlignment < 50 },
  { factor: 'EMA', bucket: 'ALIGNED', match: s => s.emaAlignment === true },
  { factor: 'EMA', bucket: 'NOT ALIGNED', match: s => s.emaAlignment === false },
  { factor: 'REGIME', bucket: 'TREND', match: s => s.marketRegime === 'TREND' },
  { factor: 'REGIME', bucket: 'CHOP', match: s => s.marketRegime === 'CHOP' },
  { factor: 'REGIME', bucket: 'BREAKOUT', match: s => s.marketRegime === 'BREAKOUT' },
  { factor: 'VWAP DIST', bucket: 'NEAR (<1%)', match: s => Math.abs(s.vwapDistance ?? 0) < 0.01 },
  { factor: 'VWAP DIST', bucket: 'EXTENDED (>1.2%)', match: s => Math.abs(s.vwapDistance ?? 0) >= 0.012 },
  { factor: 'ENTRY TIMING', bucket: 'READY/TRIGGERED', match: s => s.captureStage !== 'ENTERED' },
  { factor: 'ENTRY TIMING', bucket: 'LATE (ENTERED)', match: s => s.captureStage === 'ENTERED' }
];

@Injectable({ providedIn: 'root' })
export class SignalFactorCorrelationService {

  analyze(signals: SignalSnapshot[]): FactorCorrelationRow[] {
    return BUCKETS
      .map(b => this.row(signals, b.factor, b.bucket, b.match))
      .filter(r => r.sampleCount >= 3)
      .sort((a, b) => b.expectancyR - a.expectancyR);
  }

  topInsights(rows: FactorCorrelationRow[]): string[] {
    const insights: string[] = [];
    const rvolHigh = rows.find(r => r.factor === 'RVOL' && r.bucket === '> 3.0');
    const rvolLow = rows.find(r => r.factor === 'RVOL' && r.bucket === '< 1.5');
    if (rvolHigh && rvolLow && rvolHigh.winRate > rvolLow.winRate + 15) {
      insights.push(`High RVOL strongly correlates with continuation (${rvolHigh.winRate}% vs ${rvolLow.winRate}%)`);
    }

    const trendHigh = rows.find(r => r.factor === 'TREND ALIGN' && r.bucket === '≥ 80');
    if (trendHigh && trendHigh.expectancyR > 0.3) {
      insights.push(`Trend alignment > 80: ${trendHigh.expectancyR >= 0 ? '+' : ''}${trendHigh.expectancyR.toFixed(2)}R expectancy`);
    }

    const chop = rows.find(r => r.factor === 'REGIME' && r.bucket === 'CHOP');
    if (chop && chop.expectancyR < -0.1) {
      insights.push(`Momentum setups fail rapidly in CHOP (${chop.expectancyR.toFixed(2)}R expectancy)`);
    }

    const late = rows.find(r => r.factor === 'ENTRY TIMING' && r.bucket === 'LATE (ENTERED)');
    const early = rows.find(r => r.factor === 'ENTRY TIMING' && r.bucket === 'READY/TRIGGERED');
    if (late && early && early.expectancyR > late.expectancyR + 0.15) {
      const reduction = Math.round((1 - late.expectancyR / Math.max(0.01, early.expectancyR)) * 100);
      insights.push(`Late entries reduce expectancy by ${Math.min(99, Math.max(0, reduction))}%`);
    }

    return insights.slice(0, 4);
  }

  private row(
    signals: SignalSnapshot[],
    factor: string,
    bucket: string,
    match: (s: SignalSnapshot) => boolean
  ): FactorCorrelationRow {
    const bucketSignals = signals.filter(match);
    const evaluated = evaluatedSignals(bucketSignals);
    const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
    return {
      factor,
      bucket,
      sampleCount: evaluated.length,
      winRate: pct(wins.length, evaluated.length),
      expectancyR: computeExpectancyR(bucketSignals),
      avgMfeR: avgEval(evaluated, 'mfeR'),
      avgMaeR: avgEval(evaluated, 'maeR'),
      confidence: confidenceFromCount(evaluated.length)
    };
  }
}

function avgEval(signals: SignalSnapshot[], field: 'mfeR' | 'maeR'): number {
  if (!signals.length) return 0;
  const sum = signals.reduce((a, s) => a + (s.evaluation![field] ?? 0), 0);
  return Math.round((sum / signals.length) * 100) / 100;
}
