import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { EntryLocationMetrics, EntryLocationType, LiveAdaptiveEntryInput } from './adaptive-entry.models';
import { classifyEntryLocation, classifyLiveEntryLocation, ENTRY_LOCATION_LABELS, round2 } from './adaptive-entry.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();
const LOCATIONS: EntryLocationType[] = [
  'IDEAL_LOCATION', 'INSTITUTIONAL_LOCATION', 'EARLY_ACCEPTANCE', 'LATE_ACCEPTANCE',
  'EXTENDED_LOCATION', 'EXHAUSTED_LOCATION', 'TRAP_LOCATION'
];

/** Classify and score WHERE entry occurred within narratives. */
export class EntryLocationQualityEngine {
  analyze(signals: SignalSnapshot[]): EntryLocationMetrics[] {
    const evaluated = evaluatedSignals(signals);
    const buckets = new Map<EntryLocationType, SignalSnapshot[]>();

    for (const s of evaluated) {
      const loc = classifyEntryLocation(s);
      buckets.set(loc, [...(buckets.get(loc) ?? []), s]);
    }

    return LOCATIONS.map(location => {
      const bucket = buckets.get(location) ?? [];
      const n = bucket.length;
      const exp = computeExpectancyR(bucket);
      const cont = bucket.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
      const fake = bucket.filter(s => falseBreakout.isFalseBreakout(s));

      let verdict: EntryLocationMetrics['verdict'] = 'NEUTRAL';
      if (n >= 5 && exp >= 0.5) verdict = 'BEST';
      if (n >= 5 && exp < -0.3) verdict = 'DANGEROUS';

      return {
        location,
        label: ENTRY_LOCATION_LABELS[location],
        sampleCount: n,
        expectancyR: round2(exp),
        fakeoutRate: pct(fake.length, n || 1),
        continuationRate: pct(cont.length, n || 1),
        verdict,
        confidence: confidenceFromCount(n)
      };
    }).sort((a, b) => b.expectancyR - a.expectancyR);
  }

  classifyLive(input: LiveAdaptiveEntryInput): EntryLocationType {
    return classifyLiveEntryLocation(input);
  }
}
