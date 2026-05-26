import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { StateTransitionExpectancyRow } from './market-state.models';
import { deriveMarketStateSequence, pathKey, round2 } from './market-state.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Measure expectancy by state transition paths (A → B → C). */
export class StateTransitionExpectancyEngine {
  analyze(signals: SignalSnapshot[]): StateTransitionExpectancyRow[] {
    const evaluated = evaluatedSignals(signals);
    const buckets = new Map<string, SignalSnapshot[]>();

    for (const s of evaluated) {
      const states = deriveMarketStateSequence(s);
      const key = pathKey(states.slice(0, Math.min(4, states.length)));
      buckets.set(key, [...(buckets.get(key) ?? []), s]);
    }

    return [...buckets.entries()]
      .filter(([, bucket]) => bucket.length >= 3)
      .map(([pathKeyStr, bucket]) => {
        const states = pathKeyStr.split('→') as import('./market-state.models').MarketState[];
        const cont = bucket.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
        const fake = bucket.filter(s => falseBreakout.isFalseBreakout(s));
        const survival = bucket.filter(s => s.evaluation!.status === 'WIN').length;

        return {
          pathKey: pathKeyStr,
          states,
          sampleCount: bucket.length,
          expectancyR: computeExpectancyR(bucket),
          continuationRate: pct(cont.length, bucket.length),
          fakeoutRate: pct(fake.length, bucket.length),
          sustainability: pct(cont.length, bucket.length),
          survival: pct(survival, bucket.length),
          confidence: confidenceFromCount(bucket.length)
        };
      })
      .sort((a, b) => b.expectancyR - a.expectancyR);
  }

  topPaths(rows: StateTransitionExpectancyRow[], n = 8): StateTransitionExpectancyRow[] {
    return rows.filter(r => r.sampleCount >= 5).slice(0, n);
  }

  dangerousPaths(rows: StateTransitionExpectancyRow[], n = 6): StateTransitionExpectancyRow[] {
    return [...rows]
      .filter(r => r.sampleCount >= 5 && r.expectancyR < 0)
      .sort((a, b) => a.expectancyR - b.expectancyR)
      .slice(0, n);
  }
}
