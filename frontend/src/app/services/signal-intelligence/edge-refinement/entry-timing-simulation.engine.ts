import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct, avg, computeExpectancyR } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { entryQuality } from '../edge-discovery/edge-cluster-metrics.util';
import { EntryTimingSimulationRow } from './suppression-validation.models';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Compare expectancy by entry timing quality. */
export class EntryTimingSimulationEngine {

  analyze(signals: SignalSnapshot[]): EntryTimingSimulationRow[] {
    const evaluated = evaluatedSignals(signals);
    const timings: { key: string; match: (s: SignalSnapshot) => boolean }[] = [
      { key: 'EARLY', match: s => entryQuality(s) === 'IDEAL' && (s.sessionTimeMinutes ?? 0) <= 8 },
      { key: 'IDEAL', match: s => entryQuality(s) === 'IDEAL' || entryQuality(s) === 'GOOD' },
      { key: 'LATE', match: s => entryQuality(s) === 'LATE' },
      { key: 'CHASE', match: s => entryQuality(s) === 'CHASE' }
    ];

    return timings
      .map(t => {
        const bucket = evaluated.filter(t.match);
        if (bucket.length < 2) return null;
        const falseOnes = bucket.filter(s => falseBreakout.isFalseBreakout(s));
        return {
          timing: t.key,
          sampleCount: bucket.length,
          expectancyR: round2(computeExpectancyR(bucket)),
          winRate: pct(bucket.filter(s => s.evaluation!.status === 'WIN').length, bucket.length),
          fakeoutRate: pct(falseOnes.length, bucket.length),
          avgMfeR: round2(avg(bucket.map(s => s.evaluation!.mfeR)))
        };
      })
      .filter(Boolean) as EntryTimingSimulationRow[];
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
