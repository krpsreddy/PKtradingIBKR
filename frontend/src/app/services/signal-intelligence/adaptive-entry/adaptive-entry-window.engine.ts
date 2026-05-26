import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { avg, computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { EntryWindowMetrics } from './adaptive-entry.models';
import {
  classifyEntryWindow,
  ENTRY_WINDOW_LABELS,
  entryMfeProxy,
  narrativeCapturePct,
  round2
} from './adaptive-entry.util';
import { EntryWindow } from './adaptive-entry.models';

const falseBreakout = new FalseBreakoutAnalyticsEngine();
const WINDOWS: EntryWindow[] = [
  'INSTANT_RECLAIM', 'RECLAIM_HOLD', 'PULLBACK_STABILIZATION',
  'SECOND_LEG_TRIGGER', 'POST_ACCEPTANCE_CONTINUATION', 'INSTANT_BREAKOUT', 'FIRST_PUSH'
];

/** Best entry timing inside narrative transitions. */
export class AdaptiveEntryWindowEngine {
  analyze(signals: SignalSnapshot[]): EntryWindowMetrics[] {
    const evaluated = evaluatedSignals(signals);
    const buckets = new Map<EntryWindow, SignalSnapshot[]>();

    for (const s of evaluated) {
      const window = classifyEntryWindow(s);
      buckets.set(window, [...(buckets.get(window) ?? []), s]);
    }

    return WINDOWS.map(window => {
      const bucket = buckets.get(window) ?? [];
      const n = bucket.length;
      const cont = bucket.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
      const fake = bucket.filter(s => falseBreakout.isFalseBreakout(s));
      const missed = bucket.map(s => {
        const cap = narrativeCapturePct(s, entryMfeProxy(s, window));
        return Math.max(0, 100 - cap);
      });

      return {
        window,
        label: ENTRY_WINDOW_LABELS[window],
        sampleCount: n,
        expectancyR: round2(computeExpectancyR(bucket)),
        continuationRate: pct(cont.length, n || 1),
        fakeoutRate: pct(fake.length, n || 1),
        avgMaeR: round2(avg(bucket.map(s => Math.abs(s.evaluation!.maeR)))),
        missedExpansionPct: round2(avg(missed)),
        confidence: confidenceFromCount(n)
      };
    }).sort((a, b) => b.expectancyR - a.expectancyR);
  }
}
