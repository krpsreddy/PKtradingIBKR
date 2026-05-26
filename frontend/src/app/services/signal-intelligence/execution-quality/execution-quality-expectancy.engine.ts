import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { avg, computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import {
  ClassificationExpectancyRow,
  ClassificationExpectancySummary,
  ExecutionEntryClassification
} from './execution-quality.models';
import { ExecutionEntryClassificationEngine } from './execution-entry-classification.engine';
import { MIN_AUTHORITATIVE_SAMPLE, meetsMultiValidation } from './execution-quality.util';
import { SIGNAL_INTELLIGENCE_LOOKBACK_DAYS, MarketRegime } from '../../../models/signal-intelligence.model';

const falseBreakout = new FalseBreakoutAnalyticsEngine();
const CLASSIFICATIONS: ExecutionEntryClassification[] = [
  'IDEAL', 'ACCEPTABLE', 'RECLAIM_CONFIRMED', 'EARLY_PROBE', 'EXTENDED',
  'CHASE', 'EXHAUSTED', 'TRAP_RISK', 'LIQUIDITY_SWEEP_RISK'
];

/** 60-day expectancy analytics by classification, setup, regime, timing, breadth, RVOL. */
export class ExecutionQualityExpectancyEngine {
  private readonly classifier = new ExecutionEntryClassificationEngine();

  analyze(signals: SignalSnapshot[]): ClassificationExpectancySummary {
    const evaluated = evaluatedSignals(signals);
    const classified = evaluated.map(s => ({
      signal: s,
      result: this.classifier.classify(s, evaluated.length)
    }));

    const byClassification = CLASSIFICATIONS.map(c => {
      const bucket = classified.filter(x => x.result.classification === c).map(x => x.signal);
      return this.row(c, '*', '*', bucket);
    }).filter(r => r.sampleCount > 0);

    const matrix: ClassificationExpectancyRow[] = [];
    for (const c of CLASSIFICATIONS) {
      for (const setup of unique(classified.map(x => x.signal.signalType))) {
        for (const regime of unique(classified.map(x => x.signal.marketRegime))) {
          const bucket = classified
            .filter(x => x.result.classification === c && x.signal.signalType === setup && x.signal.marketRegime === regime)
            .map(x => x.signal);
          if (bucket.length < 2) continue;
          matrix.push(this.row(c, setup, regime, bucket));
        }
      }
    }

    matrix.sort((a, b) => b.expectancyR - a.expectancyR || b.sampleCount - a.sampleCount);

    return {
      byClassification,
      matrix,
      lookbackDays: SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
      totalEvaluated: evaluated.length,
      advisoryOnly: true
    };
  }

  private row(
    classification: ExecutionEntryClassification,
    setup: string,
    regime: string,
    bucket: SignalSnapshot[]
  ): ClassificationExpectancyRow {
    const wins = bucket.filter(s => s.evaluation!.status === 'WIN');
    const hit1 = bucket.filter(s => s.evaluation!.hit1R);
    const hit2 = bucket.filter(s => s.evaluation!.hit2R);
    const falseOnes = bucket.filter(s => falseBreakout.isFalseBreakout(s));
    const contWins = wins.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
    const n = bucket.length;
    const conf = confidenceFromCount(n);
    const authoritative = n >= MIN_AUTHORITATIVE_SAMPLE && meetsMultiValidation(bucket);

    return {
      classification,
      setup: setup === '*' ? 'ALL' : setup,
      regime: regime === '*' ? 'ALL' : regime as MarketRegime,
      sampleCount: n,
      winRate: pct(wins.length, n),
      expectancyR: computeExpectancyR(bucket),
      fakeoutRate: pct(falseOnes.length, n),
      continuationSuccess: pct(contWins.length, n),
      avgMfeR: avg(bucket.map(s => s.evaluation!.mfeR)),
      avgMaeR: avg(bucket.map(s => s.evaluation!.maeR)),
      hit1RRate: pct(hit1.length, n),
      hit2RRate: pct(hit2.length, n),
      confidence: authoritative ? conf : { ...conf, level: 'LOW', label: n < MIN_AUTHORITATIVE_SAMPLE ? 'INSUFFICIENT SAMPLE' : 'LOW CONFIDENCE' }
    };
  }
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
