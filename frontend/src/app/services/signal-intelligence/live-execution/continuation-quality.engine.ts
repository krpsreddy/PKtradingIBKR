import {
  FalseBreakoutSnapshot,
  OpeningDriveSnapshot,
  SignalSnapshot
} from '../../../models/signal-intelligence.model';
import { avg, evaluatedSignals, pct } from '../signal-intelligence.math';
import { ContinuationQualityLevel, ContinuationQualitySnapshot, LiveExecutionContext } from './live-execution.models';

/** Measures whether moves sustain after entry — live + historical. */
export class ContinuationQualityEngine {

  evaluate(
    ctx: LiveExecutionContext,
    falseBreakout: FalseBreakoutSnapshot,
    openingDrive: OpeningDriveSnapshot,
    symbolSignals: SignalSnapshot[]
  ): ContinuationQualitySnapshot {
    const evaluated = evaluatedSignals(symbolSignals);
    const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
    const contWins = wins.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
    const persistence = evaluated.length ? pct(contWins.length, evaluated.length) : 0;
    const hit2 = evaluated.filter(s => s.evaluation!.hit2R);
    const secondLeg = evaluated.length ? pct(hit2.length, evaluated.length) : 0;
    const pullbacks = evaluated.map(s => Math.abs(s.evaluation!.maeR ?? 0));
    const pullbackDepth = avg(pullbacks);
    const momentum = falseBreakout.continuationQuality;
    const reclaimStable = openingDrive.openingDriveType === 'OPENING_RECLAIM'
      || openingDrive.continuationProbability > 55;

    const score =
      persistence * 0.3 +
      secondLeg * 0.25 +
      momentum * 0.25 +
      (reclaimStable ? 15 : 0) +
      (pullbackDepth < 0.5 ? 10 : pullbackDepth > 0.8 ? -10 : 0);

    const level = classifyLevel(score, persistence, momentum);

    return {
      level,
      label: level.replace(/_/g, ' '),
      persistence,
      secondLegProbability: secondLeg,
      pullbackDepth,
      momentumSustainability: momentum,
      reclaimStability: reclaimStable ? 72 : 40
    };
  }
}

function classifyLevel(score: number, persistence: number, momentum: number): ContinuationQualityLevel {
  if (score >= 75 && persistence >= 55) return 'VERY_STRONG';
  if (score >= 58 && persistence >= 45) return 'STRONG';
  if (score >= 42) return 'MODERATE';
  if (score >= 28 || momentum >= 35) return 'WEAK';
  return 'FAILING';
}

export function continuationMatrixStatus(level: ContinuationQualityLevel): 'STRONG' | 'NEUTRAL' | 'WEAK' | 'POOR' {
  switch (level) {
    case 'VERY_STRONG':
    case 'STRONG':
      return 'STRONG';
    case 'MODERATE':
      return 'NEUTRAL';
    case 'WEAK':
      return 'WEAK';
    case 'FAILING':
      return 'POOR';
  }
}
