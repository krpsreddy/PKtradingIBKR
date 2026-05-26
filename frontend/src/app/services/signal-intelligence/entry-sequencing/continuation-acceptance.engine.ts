import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { breadthBucket } from '../edge-discovery/edge-cluster-metrics.util';
import { ContinuationAcceptanceLevel, ContinuationAcceptanceReport } from './entry-sequencing.models';
import { ReclaimAcceptanceValidationEngine } from './reclaim-acceptance-validation.engine';
import { PullbackStabilityEngine } from './pullback-stability.engine';
import { extensionPct, windows, w } from './entry-sequencing.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Determine whether continuation is accepted vs forced/emotional. */
export class ContinuationAcceptanceEngine {
  private readonly reclaim = new ReclaimAcceptanceValidationEngine();
  private readonly pullback = new PullbackStabilityEngine();

  analyze(signals: SignalSnapshot[]): ContinuationAcceptanceReport {
    const evaluated = evaluatedSignals(signals);
    const levels: ContinuationAcceptanceLevel[] = [
      'VERY_STRONG_ACCEPTANCE', 'STRONG_ACCEPTANCE', 'NEUTRAL_ACCEPTANCE',
      'WEAK_ACCEPTANCE', 'FAILING_ACCEPTANCE'
    ];

    const byLevel = levels.map(level => {
      const bucket = evaluated.filter(s => this.classify(s) === level);
      const falseOnes = bucket.filter(s => falseBreakout.isFalseBreakout(s));
      return {
        level,
        sampleCount: bucket.length,
        expectancyR: bucket.length ? computeExpectancyR(bucket) : 0,
        fakeoutRate: bucket.length ? pct(falseOnes.length, bucket.length) : 0
      };
    }).filter(r => r.sampleCount > 0);

    const dominant = byLevel.sort((a, b) => b.sampleCount - a.sampleCount)[0];

    return {
      level: dominant?.level ?? 'NEUTRAL_ACCEPTANCE',
      sampleCount: evaluated.length,
      expectancyR: evaluated.length ? computeExpectancyR(evaluated) : 0,
      fakeoutRate: evaluated.length
        ? pct(evaluated.filter(s => falseBreakout.isFalseBreakout(s)).length, evaluated.length)
        : 0,
      byLevel,
      advisoryOnly: true
    };
  }

  classify(s: SignalSnapshot): ContinuationAcceptanceLevel {
    const m15 = w(windows(s).w15);
    const m5 = w(windows(s).w5);
    const breadth = breadthBucket(s);
    const reclaimHeld = this.reclaim.reclaimHeld(s);
    const pullback = this.pullback.classify(s);
    const ext = extensionPct(s);
    const rvol = s.rvol ?? 0;

    let score = 50;
    if (breadth === 'STRONG') score += 18;
    else if (breadth === 'WEAK') score -= 15;
    if (reclaimHeld) score += 12;
    if (pullback === 'VERY_STABLE' || pullback === 'STABLE') score += 10;
    if (pullback === 'FAILING') score -= 20;
    if (m15.mfe >= 0.8) score += 15;
    else if (m15.mfe >= 0.45) score += 8;
    if (m15.mfe < m5.mfe && m5.mfe > 0.3) score -= 12;
    if (ext >= 8 && rvol >= 5) score -= 15;
    if (falseBreakout.isFalseBreakout(s)) score -= 25;
    if ((s.trendAlignment ?? 0) >= 75) score += 8;

    if (score >= 78) return 'VERY_STRONG_ACCEPTANCE';
    if (score >= 62) return 'STRONG_ACCEPTANCE';
    if (score >= 45) return 'NEUTRAL_ACCEPTANCE';
    if (score >= 28) return 'WEAK_ACCEPTANCE';
    return 'FAILING_ACCEPTANCE';
  }
}
