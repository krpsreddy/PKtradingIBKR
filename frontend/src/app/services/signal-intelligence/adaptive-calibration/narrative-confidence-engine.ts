import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { NarrativeTrajectory } from '../market-state/market-state.models';
import { MarketStateMachineEngine } from '../market-state/market-state-machine.engine';
import { NarrativeConfidenceReport, NarrativeConfidenceRow } from './adaptive-calibration.models';
import { continuationAchieved, narrativeStability, round2 } from './adaptive-calibration.util';

const TRAJECTORIES: NarrativeTrajectory[] = [
  'NARRATIVE_IMPROVING',
  'NARRATIVE_STABLE',
  'NARRATIVE_FAILING',
  'NARRATIVE_EXHAUSTED'
];

/** Adjust confidence based on narrative stability — stable narratives allow aggression. */
export class NarrativeConfidenceEngine {
  private readonly stateMachine = new MarketStateMachineEngine();

  analyze(signals: SignalSnapshot[]): NarrativeConfidenceReport {
    const evaluated = evaluatedSignals(signals);
    const buckets = new Map<NarrativeTrajectory, SignalSnapshot[]>();

    for (const s of evaluated) {
      const trajectory = this.stateMachine.path(s).trajectory;
      buckets.set(trajectory, [...(buckets.get(trajectory) ?? []), s]);
    }

    const rows: NarrativeConfidenceRow[] = TRAJECTORIES.map(trajectory => {
      const bucket = buckets.get(trajectory) ?? [];
      const stabilityScores = bucket.map(narrativeStability);
      const avgStability = stabilityScores.length
        ? round2(stabilityScores.reduce((a, b) => a + b, 0) / stabilityScores.length)
        : 0;

      return {
        trajectory,
        sampleCount: bucket.length,
        stabilityScore: avgStability,
        expectancyR: computeExpectancyR(bucket),
        continuationRate: pct(bucket.filter(continuationAchieved).length, bucket.length),
        aggressionAllowed: trajectory === 'NARRATIVE_IMPROVING' || trajectory === 'NARRATIVE_STABLE',
        confidence: confidenceFromCount(bucket.length)
      };
    }).sort((a, b) => b.stabilityScore - a.stabilityScore);

    const unstable = rows.filter(r =>
      r.trajectory === 'NARRATIVE_FAILING' || r.trajectory === 'NARRATIVE_EXHAUSTED'
    );
    const totalUnstable = unstable.reduce((s, r) => s + r.sampleCount, 0);
    const unstableNarrativeRate = pct(totalUnstable, evaluated.length);

    return { rows, unstableNarrativeRate, advisoryOnly: true };
  }
}
