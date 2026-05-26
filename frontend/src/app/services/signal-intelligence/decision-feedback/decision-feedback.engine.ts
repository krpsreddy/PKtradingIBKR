import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { LiveDecisionEngine } from '../live-decision/live-decision-engine';
import { DecisionAccuracyStat, DecisionAuditRow } from './decision-feedback.models';
import {
  breadthLabel,
  contextFromSignal,
  isDecisionCorrect,
  isFakeout,
  realizedR
} from './decision-feedback.util';
import { deriveMarketStateSequence, pathKey } from '../market-state/market-state.util';
import { LiveExecutionDecision } from '../live-decision/live-decision.models';

/** Evaluate historical decision outcomes against 60D results. */
export class DecisionFeedbackEngine {
  private readonly decisionEngine = new LiveDecisionEngine();

  analyze(signals: SignalSnapshot[]): { rows: DecisionAuditRow[]; accuracy: DecisionAccuracyStat[] } {
    const evaluated = evaluatedSignals(signals);
    const rows: DecisionAuditRow[] = [];
    const buckets = new Map<LiveExecutionDecision, SignalSnapshot[]>();

    for (const s of evaluated) {
      const ctx = contextFromSignal(s, evaluated.length);
      const snap = this.decisionEngine.decide(ctx);
      const decision = snap.decision;
      buckets.set(decision, [...(buckets.get(decision) ?? []), s]);

      rows.push({
        signalId: s.id,
        symbol: s.symbol,
        timestamp: s.timestamp,
        decision,
        conviction: snap.conviction.band,
        setup: s.signalType ?? '—',
        regime: s.marketRegime ?? '—',
        breadth: breadthLabel(s),
        executionQuality: snap.entryQuality,
        continuationQuality: snap.sustainability,
        outcome: s.evaluation!.status,
        expectancyR: realizedR(s),
        fakeout: isFakeout(s),
        mfeR: s.evaluation!.mfeR,
        maeR: s.evaluation!.maeR,
        correct: isDecisionCorrect(decision, s),
        marketStatePath: pathKey(deriveMarketStateSequence(s))
      });
    }

    const accuracy = [...buckets.entries()].map(([decision, bucket]) => {
      const correct = bucket.filter(s => isDecisionCorrect(decision, s)).length;
      const falseOnes = bucket.filter(isFakeout);
      const isAvoid = decision === 'AVOID_TRADE' || decision === 'TRAP_RISK' || decision === 'AVOID_CHASE';
      const correctAvoidance = isAvoid
        ? bucket.filter(s => s.evaluation!.status === 'LOSS' || isFakeout(s)).length
        : undefined;

      return {
        decision,
        sampleCount: bucket.length,
        winRate: pct(bucket.filter(s => s.evaluation!.status === 'WIN').length, bucket.length),
        expectancyR: computeExpectancyR(bucket),
        fakeoutRate: pct(falseOnes.length, bucket.length),
        accuracyRate: pct(correct, bucket.length),
        correctAvoidanceRate: correctAvoidance !== undefined ? pct(correctAvoidance, bucket.length) : undefined,
        confidence: confidenceFromCount(bucket.length)
      };
    }).sort((a, b) => b.expectancyR - a.expectancyR);

    return { rows, accuracy };
  }
}
