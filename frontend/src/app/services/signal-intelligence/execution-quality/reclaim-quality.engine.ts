import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { ReclaimQualityReport } from './execution-quality.models';
import { extensionBucketLabel, extensionPct, timingWindowLabel } from './execution-quality.util';
import { windowAt } from '../trade-lifecycle/trade-lifecycle.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Deep reclaim validation — hold, continuation, fakeout, timing buckets. */
export class ReclaimQualityEngine {

  analyze(signals: SignalSnapshot[]): ReclaimQualityReport {
    const reclaims = evaluatedSignals(signals).filter(s =>
      s.signalType === 'VWAP_RECLAIM' || s.signalType === 'BREAKOUT'
    );

    if (!reclaims.length) {
      return emptyReport();
    }

    const held = reclaims.filter(s => this.reclaimHeld(s));
    const continued = reclaims.filter(s => (windowAt(s.evaluation, 15)?.mfeR ?? s.evaluation!.mfeR ?? 0) >= 0.5);
    const falseOnes = reclaims.filter(s => falseBreakout.isFalseBreakout(s));
    const rejected = reclaims.filter(s => (s.evaluation?.maeR ?? 0) < -0.5 && !(s.evaluation?.hit1R));

    const timingMap = new Map<string, SignalSnapshot[]>();
    const extMap = new Map<string, SignalSnapshot[]>();
    const setupRegimeMap = new Map<string, SignalSnapshot[]>();

    for (const s of reclaims) {
      const tw = timingWindowLabel(s);
      timingMap.set(tw, [...(timingMap.get(tw) ?? []), s]);
      const eb = extensionBucketLabel(extensionPct(s));
      extMap.set(eb, [...(extMap.get(eb) ?? []), s]);
      const key = `${s.signalType}·${s.marketRegime}`;
      setupRegimeMap.set(key, [...(setupRegimeMap.get(key) ?? []), s]);
    }

    return {
      sampleCount: reclaims.length,
      holdRate: pct(held.length, reclaims.length),
      continuationRate: pct(continued.length, reclaims.length),
      fakeoutRate: pct(falseOnes.length, reclaims.length),
      rejectionRate: pct(rejected.length, reclaims.length),
      expectancyR: computeExpectancyR(reclaims),
      timingBuckets: [...timingMap.entries()].map(([window, bucket]) => ({
        window,
        sampleCount: bucket.length,
        holdRate: pct(bucket.filter(s => this.reclaimHeld(s)).length, bucket.length),
        continuationRate: pct(bucket.filter(s => (windowAt(s.evaluation, 15)?.mfeR ?? 0) >= 0.5).length, bucket.length),
        fakeoutRate: pct(bucket.filter(s => falseBreakout.isFalseBreakout(s)).length, bucket.length),
        expectancyR: computeExpectancyR(bucket)
      })).sort((a, b) => b.expectancyR - a.expectancyR),
      extensionBuckets: [...extMap.entries()].map(([bucket, rows]) => ({
        bucket,
        sampleCount: rows.length,
        holdRate: pct(rows.filter(s => this.reclaimHeld(s)).length, rows.length),
        expectancyR: computeExpectancyR(rows)
      })),
      failurePatterns: this.failurePatterns(reclaims),
      bySetupRegime: [...setupRegimeMap.entries()]
        .filter(([, rows]) => rows.length >= 2)
        .map(([key, rows]) => ({
          key,
          sampleCount: rows.length,
          expectancyR: computeExpectancyR(rows),
          holdRate: pct(rows.filter(s => this.reclaimHeld(s)).length, rows.length)
        }))
        .sort((a, b) => b.expectancyR - a.expectancyR),
      advisoryOnly: true
    };
  }

  private reclaimHeld(s: SignalSnapshot): boolean {
    const w5 = windowAt(s.evaluation, 5);
    return (w5?.mfeR ?? s.evaluation?.mfeR ?? 0) >= 0.15 && (w5?.maeR ?? s.evaluation?.maeR ?? 0) > -0.4;
  }

  private failurePatterns(reclaims: SignalSnapshot[]): string[] {
    const patterns: string[] = [];
    const weak = reclaims.filter(s => (s.trendAlignment ?? 0) < 50);
    if (weak.length >= 3 && computeExpectancyR(weak) < 0) {
      patterns.push('Weak breadth reclaims fail consistently');
    }
    const extended = reclaims.filter(s => extensionPct(s) >= 8);
    if (extended.length >= 2 && pct(extended.filter(s => falseBreakout.isFalseBreakout(s)).length, extended.length) >= 40) {
      patterns.push('Extended reclaims (>8%) show elevated fakeout');
    }
    const opening = reclaims.filter(s => (s.sessionTimeMinutes ?? 999) < 15);
    if (opening.length >= 3 && computeExpectancyR(opening) < -0.1) {
      patterns.push('Opening-window reclaims without hold confirmation fail');
    }
    return patterns.slice(0, 5);
  }
}

function emptyReport(): ReclaimQualityReport {
  return {
    sampleCount: 0, holdRate: 0, continuationRate: 0, fakeoutRate: 0, rejectionRate: 0,
    expectancyR: 0, timingBuckets: [], extensionBuckets: [], failurePatterns: [],
    bySetupRegime: [], advisoryOnly: true
  };
}
