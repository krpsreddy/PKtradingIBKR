import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { breadthBucket } from '../edge-discovery/edge-cluster-metrics.util';
import { ChaseSubClassification, GoodVsBadChasePanel, GoodVsBadChaseReport } from './execution-quality.models';
import { ExecutionEntryClassificationEngine } from './execution-entry-classification.engine';
import {
  computeFeatureScores,
  estimateExpansionLeg,
  isStrongTrendContinuation,
  extensionPct
} from './execution-quality.util';
import { windowAt } from '../trade-lifecycle/trade-lifecycle.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Separates professional continuation chase from emotional chase. */
export class GoodVsBadChaseEngine {
  private readonly classifier = new ExecutionEntryClassificationEngine();

  analyze(signals: SignalSnapshot[]): GoodVsBadChaseReport {
    const chaseSignals = evaluatedSignals(signals).filter(s => {
      const c = this.classifier.classify(s, signals.length);
      return c.classification === 'CHASE' || c.classification === 'EXTENDED';
    });

    const buckets: Record<ChaseSubClassification, SignalSnapshot[]> = {
      GOOD_CHASE: [],
      BAD_CHASE: [],
      NEUTRAL_CHASE: []
    };

    for (const s of chaseSignals) {
      buckets[this.subType(s)].push(s);
    }

    return {
      good: this.panel('GOOD_CHASE', buckets.GOOD_CHASE),
      bad: this.panel('BAD_CHASE', buckets.BAD_CHASE),
      neutral: this.panel('NEUTRAL_CHASE', buckets.NEUTRAL_CHASE),
      advisoryOnly: true
    };
  }

  subType(s: SignalSnapshot): ChaseSubClassification {
    const scores = computeFeatureScores(s);
    let good = 0;
    let bad = 0;

    if (scores.breadthStrong || breadthBucket(s) === 'STRONG') good += 2;
    if (isStrongTrendContinuation(s)) good += 2;
    if (scores.reclaimHeld || scores.continuationStrong) good += 2;
    if (scores.extensionPct <= 6) good += 1;
    if ((windowAt(s.evaluation, 5)?.mfeR ?? 0) >= 0.4) good += 1;

    if (breadthBucket(s) === 'WEAK') bad += 2;
    if (s.marketRegime === 'CHOP') bad += 2;
    if (estimateExpansionLeg(s) >= 3) bad += 2;
    if (scores.momentumAccelerating && extensionPct(s) >= 8) bad += 2;
    if (falseBreakout.isFalseBreakout(s)) bad += 2;
    if (scores.fakeoutElevated) bad += 1;

    if (good >= 4 && bad <= 2) return 'GOOD_CHASE';
    if (bad >= 4 && good <= 2) return 'BAD_CHASE';
    return 'NEUTRAL_CHASE';
  }

  private panel(subType: ChaseSubClassification, bucket: SignalSnapshot[]): GoodVsBadChasePanel {
    const n = bucket.length;
    const wins = bucket.filter(s => s.evaluation!.status === 'WIN');
    const falseOnes = bucket.filter(s => falseBreakout.isFalseBreakout(s));
    const contWins = wins.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
    const exhausted = bucket.filter(s => estimateExpansionLeg(s) >= 3);

    return {
      subType,
      sampleCount: n,
      expectancyR: n ? computeExpectancyR(bucket) : 0,
      winRate: n ? pct(wins.length, n) : 0,
      fakeoutRate: n ? pct(falseOnes.length, n) : 0,
      continuationSuccess: n ? pct(contWins.length, n) : 0,
      exhaustionRate: n ? pct(exhausted.length, n) : 0,
      bestConditions: this.bestConditions(subType),
      advisoryOnly: true
    };
  }

  private bestConditions(subType: ChaseSubClassification): string[] {
    switch (subType) {
      case 'GOOD_CHASE':
        return ['Strong breadth', 'Trend-aligned continuation', 'Reclaim hold confirmed', 'Controlled extension <6%'];
      case 'BAD_CHASE':
        return ['Weak breadth + chop', 'Third extension leg', 'Vertical RVOL spike', 'Elevated fakeout profile'];
      default:
        return ['Mixed signals — require confirmation', 'Breadth and extension context decisive'];
    }
  }
}
