import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { AggressiveVsPatientRow } from './adaptive-entry.models';
import { classifyEntryWindow, entryMfeProxy, entryStyle, narrativeCapturePct, round2 } from './adaptive-entry.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Compare aggressive vs patient execution styles. */
export class AggressiveVsPatientEntryEngine {
  analyze(signals: SignalSnapshot[]): AggressiveVsPatientRow[] {
    const evaluated = evaluatedSignals(signals);
    const styles: import('./adaptive-entry.models').EntryStyle[] = ['AGGRESSIVE', 'PATIENT'];

    return styles.map(style => {
      const bucket = evaluated.filter(s => entryStyle(classifyEntryWindow(s)) === style);
      const n = bucket.length;
      const wins = bucket.filter(s => s.evaluation!.status === 'WIN');
      const fake = bucket.filter(s => falseBreakout.isFalseBreakout(s));
      const cont = bucket.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
      const capture = bucket.map(s => narrativeCapturePct(s, entryMfeProxy(s, classifyEntryWindow(s))));
      const missedWinners = style === 'PATIENT'
        ? bucket.filter(s => s.evaluation!.status === 'WIN' && (s.evaluation!.mfeR ?? 0) >= 1.2).length
        : bucket.filter(s => s.evaluation!.status === 'LOSS').length;

      return {
        style,
        sampleCount: n,
        expectancyR: round2(computeExpectancyR(bucket)),
        fakeoutRate: pct(fake.length, n || 1),
        continuationSurvival: pct(cont.length, n || 1),
        expansionCapturePct: round2(capture.reduce((a, b) => a + b, 0) / Math.max(1, capture.length)),
        missedWinners,
        confidence: confidenceFromCount(n)
      };
    });
  }
}
