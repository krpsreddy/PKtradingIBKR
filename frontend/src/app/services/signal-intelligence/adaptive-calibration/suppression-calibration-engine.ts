import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { LiveExecutionDecision } from '../live-decision/live-decision.models';
import { SuppressionCalibrationReport, SuppressionCalibrationRow } from './adaptive-calibration.models';
import {
  contextFromSignal,
  isAvoidDecision,
  isFakeout,
  realizedR,
  round2
} from './adaptive-calibration.util';
import { LiveDecisionEngine } from '../live-decision/live-decision-engine';

const SUPPRESSION_ZONES: { zone: string; decisions: LiveExecutionDecision[] }[] = [
  { zone: 'TRAP_RISK', decisions: ['TRAP_RISK'] },
  { zone: 'CHASE', decisions: ['AVOID_CHASE'] },
  { zone: 'AVOID_TRADE', decisions: ['AVOID_TRADE'] },
  { zone: 'REDUCE_SIZE', decisions: ['REDUCE_SIZE'] }
];

/** Analyze whether suppressions are too aggressive. */
export class SuppressionCalibrationEngine {
  private readonly decisionEngine = new LiveDecisionEngine();

  analyze(signals: SignalSnapshot[]): SuppressionCalibrationReport {
    const evaluated = evaluatedSignals(signals);
    const rows: SuppressionCalibrationRow[] = SUPPRESSION_ZONES.map(({ zone, decisions }) => {
      const bucket = evaluated.filter(s => {
        const d = this.decisionEngine.decide(contextFromSignal(s, evaluated.length)).decision;
        return decisions.includes(d);
      });

      const winners = bucket.filter(s => s.evaluation!.status === 'WIN');
      const losers = bucket.filter(s => s.evaluation!.status === 'LOSS');
      const falseAvoids = winners.filter(s => realizedR(s) > 0.5);
      const safeSuppress = losers.filter(s => isFakeout(s) || realizedR(s) < -0.3);

      const falseAvoidRate = pct(falseAvoids.length, bucket.length);
      const missedWinnerRate = pct(winners.length, bucket.length);
      const safeSuppressionRate = pct(safeSuppress.length, bucket.length);

      let safety: SuppressionCalibrationRow['safety'] = 'INSUFFICIENT';
      if (bucket.length >= 10) {
        if (zone === 'TRAP_RISK' && safeSuppressionRate >= 55) safety = 'SAFE';
        else if (zone === 'CHASE' && falseAvoidRate > 25) safety = 'UNSAFE';
        else if (falseAvoidRate > 30 && missedWinnerRate > 40) safety = 'UNSAFE';
        else if (safeSuppressionRate >= 50) safety = 'SAFE';
        else safety = 'MARGINAL';
      }

      return {
        zone,
        decision: decisions[0],
        sampleCount: bucket.length,
        falseAvoidRate,
        missedWinnerRate,
        safeSuppressionRate,
        safety,
        confidence: confidenceFromCount(bucket.length)
      };
    }).sort((a, b) => b.safeSuppressionRate - a.safeSuppressionRate);

    const unsafe = rows.filter(r => r.safety === 'UNSAFE');
    const overSuppressionScore = round2(Math.min(100, unsafe.reduce((s, r) => s + r.falseAvoidRate, 0) / Math.max(1, unsafe.length)));

    return { rows, overSuppressionScore, advisoryOnly: true };
  }
}
