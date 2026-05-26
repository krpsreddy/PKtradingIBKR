import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals } from '../signal-intelligence.math';
import { LiveDecisionEngine } from '../live-decision/live-decision-engine';
import { LiveExecutionDecision } from '../live-decision/live-decision.models';
import { DecisionConsistencyIssue, DecisionConsistencyReport } from './decision-feedback.models';
import { contextFromSignal, contextKey, round2 } from './decision-feedback.util';

/** Detect unstable decisions — same context, inconsistent recommendations. */
export class DecisionConsistencyEngine {
  private readonly decisionEngine = new LiveDecisionEngine();

  analyze(signals: SignalSnapshot[]): DecisionConsistencyReport {
    const evaluated = evaluatedSignals(signals);
    const groups = new Map<string, LiveExecutionDecision[]>();

    for (const s of evaluated) {
      const ctx = contextFromSignal(s, evaluated.length);
      const decision = this.decisionEngine.decide(ctx).decision;
      const key = contextKey(s);
      groups.set(key, [...(groups.get(key) ?? []), decision]);
    }

    const issues: DecisionConsistencyIssue[] = [];
    let noisyClassifications = 0;

    for (const [ctxKey, decisions] of groups.entries()) {
      if (decisions.length < 4) continue;
      const counts = new Map<LiveExecutionDecision, number>();
      for (const d of decisions) counts.set(d, (counts.get(d) ?? 0) + 1);
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const dominant = sorted[0][0];
      const dominantShare = sorted[0][1] / decisions.length;
      const conflicting = sorted.slice(1).filter(([, c]) => c >= 2).map(([d]) => d);

      if (dominantShare < 0.55 && conflicting.length >= 2) {
        noisyClassifications++;
        const instabilityScore = round2((1 - dominantShare) * 100);
        issues.push({
          contextKey: ctxKey,
          sampleCount: decisions.length,
          dominantDecision: dominant,
          conflictingDecisions: conflicting,
          instabilityScore,
          note: `Mixed decisions in ${ctxKey.replace(/\|/g, ' · ')} — dominant ${dominant} at ${Math.round(dominantShare * 100)}%`
        });
      }
    }

    const unstableEdgeZones = issues
      .sort((a, b) => b.instabilityScore - a.instabilityScore)
      .slice(0, 6)
      .map(i => i.contextKey.replace(/\|/g, ' · '));

    return {
      issues: issues.sort((a, b) => b.instabilityScore - a.instabilityScore).slice(0, 12),
      unstableEdgeZones,
      noisyClassifications,
      advisoryOnly: true
    };
  }
}
