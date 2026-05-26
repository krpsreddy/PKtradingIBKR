import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { LiveDecisionEngine } from '../live-decision/live-decision-engine';
import { DecisionReliabilityScore } from './decision-feedback.models';
import {
  clampScore,
  contextFromSignal,
  reliabilityGroup,
  round2
} from './decision-feedback.util';
import { DecisionReliabilityGroup } from './decision-feedback.models';
import { DecisionConsistencyReport } from './decision-feedback.models';

const falseBreakout = new FalseBreakoutAnalyticsEngine();
const GROUP_LABELS: Record<DecisionReliabilityGroup, string> = {
  FULL_EXECUTION: 'FULL EXECUTION',
  WAIT: 'WAIT',
  REDUCE: 'REDUCE SIZE',
  AVOID: 'AVOID',
  TRAP_RISK: 'TRAP RISK'
};

/** Score each decision type 0–100 on reliability dimensions. */
export class DecisionReliabilityScoreEngine {
  private readonly decisionEngine = new LiveDecisionEngine();

  score(signals: SignalSnapshot[], consistency: DecisionConsistencyReport): DecisionReliabilityScore[] {
    const evaluated = evaluatedSignals(signals);
    const buckets = new Map<DecisionReliabilityGroup, SignalSnapshot[]>();

    for (const s of evaluated) {
      const ctx = contextFromSignal(s, evaluated.length);
      const group = reliabilityGroup(this.decisionEngine.decide(ctx).decision);
      buckets.set(group, [...(buckets.get(group) ?? []), s]);
    }

    const instabilityByGroup = this.instabilityMap(consistency);

    return (['FULL_EXECUTION', 'WAIT', 'REDUCE', 'AVOID', 'TRAP_RISK'] as DecisionReliabilityGroup[]).map(group => {
      const bucket = buckets.get(group) ?? [];
      const n = bucket.length;
      const exp = computeExpectancyR(bucket);
      const fakeouts = bucket.filter(s => falseBreakout.isFalseBreakout(s));
      const cont = bucket.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
      const missedWinners = group === 'WAIT'
        ? bucket.filter(s => s.evaluation!.status === 'WIN' && (s.evaluation!.mfeR ?? 0) >= 1.2).length
        : 0;

      const expectancyComponent = clampScore((exp + 1) / 3 * 30);
      const fakeoutAvoidance = group === 'AVOID' || group === 'TRAP_RISK'
        ? pct(fakeouts.length + bucket.filter(s => s.evaluation!.status === 'LOSS').length, n || 1)
        : pct(n - fakeouts.length, n || 1);
      const continuationSurvival = pct(cont.length, n || 1);
      const missedSeverity = n ? clampScore(100 - (missedWinners / n) * 100) : 50;
      const instability = instabilityByGroup.get(group) ?? 0;
      const stability = clampScore(100 - instability);
      const consistencyScore = clampScore(stability - (consistency.noisyClassifications > 3 ? 10 : 0));

      const raw = expectancyComponent
        + (fakeoutAvoidance / 100) * 20
        + (continuationSurvival / 100) * 15
        + (missedSeverity / 100) * 15
        + (stability / 100) * 10
        + (consistencyScore / 100) * 10;

      const samplePenalty = n < 10 ? 0.5 : n < 25 ? 0.75 : 1;

      return {
        group,
        label: GROUP_LABELS[group],
        score: clampScore(raw * samplePenalty),
        sampleCount: n,
        expectancyR: round2(exp),
        fakeoutAvoidance: round2(fakeoutAvoidance),
        continuationSurvival: round2(continuationSurvival),
        missedWinnerSeverity: round2(100 - missedSeverity),
        stability: round2(stability),
        consistency: round2(consistencyScore),
        confidence: confidenceFromCount(n)
      };
    }).sort((a, b) => b.score - a.score);
  }

  private instabilityMap(consistency: DecisionConsistencyReport): Map<DecisionReliabilityGroup, number> {
    const map = new Map<DecisionReliabilityGroup, number>();
    for (const issue of consistency.issues) {
      for (const d of [issue.dominantDecision, ...issue.conflictingDecisions]) {
        const g = reliabilityGroup(d);
        map.set(g, Math.max(map.get(g) ?? 0, issue.instabilityScore));
      }
    }
    return map;
  }
}
