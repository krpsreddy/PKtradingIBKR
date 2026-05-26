import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { entryQuality, breadthBucket } from '../edge-discovery/edge-cluster-metrics.util';
import { computeExpectancyR } from '../signal-intelligence.math';
import { DangerousEntryInsight } from './suppression-validation.models';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Analyze dangerous entry patterns — chase, extended, weak breadth, fakeouts. */
export class DangerousEntryAnalysisEngine {

  analyze(signals: SignalSnapshot[]): DangerousEntryInsight[] {
    const evaluated = evaluatedSignals(signals);
    const insights: DangerousEntryInsight[] = [];

    const buckets: { id: string; label: string; match: (s: SignalSnapshot) => boolean }[] = [
      { id: 'CHASE', label: 'Chase Entries', match: s => entryQuality(s) === 'CHASE' },
      { id: 'LATE', label: 'Late Entries', match: s => entryQuality(s) === 'LATE' },
      { id: 'EXTENDED', label: 'Extended Entries (>5%)', match: s => s.extendedEntry || Math.abs(s.vwapDistance ?? 0) > 0.05 },
      { id: 'WEAK_BREADTH', label: 'Weak Breadth Continuation', match: s => breadthBucket(s) === 'WEAK' && s.signalType !== 'REVERSAL' },
      { id: 'OPENING_FAKEOUT', label: 'Opening Fakeouts', match: s => (s.sessionTimeMinutes ?? 999) < 15 && falseBreakout.isFalseBreakout(s) },
      { id: 'LOW_ACCEPT', label: 'Low Acceptance Quality', match: s => (s.evaluation?.maeR ?? 0) < -0.5 && !(s.evaluation?.hit1R) },
      { id: 'EMOTIONAL_MOM', label: 'Emotional Momentum (RVOL>5 + extended)', match: s => s.signalType === 'MOMENTUM' && (s.rvol ?? 0) > 5 && !!s.extendedEntry }
    ];

    for (const b of buckets) {
      const bucket = evaluated.filter(b.match);
      if (bucket.length < 3) continue;
      const falseOnes = bucket.filter(s => falseBreakout.isFalseBreakout(s));
      const exp = computeExpectancyR(bucket);
      insights.push({
        id: b.id,
        label: b.label,
        sampleCount: bucket.length,
        expectancyR: exp,
        fakeoutRate: pct(falseOnes.length, bucket.length),
        severity: exp <= -0.35 ? 'HIGH' : exp <= -0.1 ? 'MEDIUM' : 'LOW',
        note: exp <= -0.35
          ? 'Statistically destructive — strong suppression candidate'
          : exp < 0
            ? 'Negative expectancy — validate before live use'
            : 'Monitor — not clearly toxic'
      });
    }

    return insights.sort((a, b) => a.expectancyR - b.expectancyR);
  }
}
