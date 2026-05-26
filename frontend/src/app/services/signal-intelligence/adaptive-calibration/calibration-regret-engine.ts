import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { confidenceFromCount, evaluatedSignals } from '../signal-intelligence.math';
import { CalibrationRegretReport } from './adaptive-calibration.models';
import {
  contextFromSignal,
  EXPECTED_R_BY_BAND,
  isAvoidDecision,
  isFakeout,
  isWaitDecision,
  realizedR,
  round2
} from './adaptive-calibration.util';
import { LiveDecisionEngine } from '../live-decision/live-decision-engine';

/** Compute overall calibration regret score. */
export class CalibrationRegretEngine {
  private readonly decisionEngine = new LiveDecisionEngine();

  analyze(signals: SignalSnapshot[]): CalibrationRegretReport {
    const evaluated = evaluatedSignals(signals);
    let missedExpansion = 0;
    let falseAvoids = 0;
    let overconfidence = 0;
    let underconfidence = 0;
    let excessiveWaiting = 0;

    for (const s of evaluated) {
      const snap = this.decisionEngine.decide(contextFromSignal(s, evaluated.length));
      const r = realizedR(s);
      const won = s.evaluation!.status === 'WIN';
      const expected = EXPECTED_R_BY_BAND[snap.conviction.band];

      if (isWaitDecision(snap.decision) && won && r >= 1.2) excessiveWaiting++;
      if (isAvoidDecision(snap.decision) && won && r > 0.5) falseAvoids++;
      if ((snap.conviction.band === 'HIGH' || snap.conviction.band === 'ELITE') && r < expected * 0.35) {
        overconfidence++;
      }
      if ((snap.conviction.band === 'MODERATE' || snap.conviction.band === 'LOW') && r > expected * 1.5 && won) {
        underconfidence++;
      }
      if (isWaitDecision(snap.decision) && won && (s.evaluation?.mfeR ?? 0) >= 1.5) missedExpansion++;
    }

    const total = evaluated.length || 1;
    const regretEvents = missedExpansion + falseAvoids + overconfidence + underconfidence + excessiveWaiting;
    const regretScore = round2(Math.min(100, (regretEvents / total) * 100 * 1.8));
    const lowRegretZone = regretScore < 25;

    return {
      regretScore,
      missedExpansion,
      falseAvoids,
      overconfidence,
      underconfidence,
      excessiveWaiting,
      lowRegretZone,
      confidence: confidenceFromCount(evaluated.length),
      advisoryOnly: true
    };
  }
}
