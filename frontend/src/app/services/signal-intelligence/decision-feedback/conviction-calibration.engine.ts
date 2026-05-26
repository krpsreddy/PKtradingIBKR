import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { LiveDecisionEngine } from '../live-decision/live-decision-engine';
import { ConvictionBand } from '../live-decision/live-decision.models';
import { ConvictionCalibrationPoint, ConvictionCalibrationReport } from './decision-feedback.models';
import { contextFromSignal, round2 } from './decision-feedback.util';

const BANDS: ConvictionBand[] = ['ELITE', 'HIGH', 'MODERATE', 'LOW', 'AVOID'];

/** Measure conviction alignment with actual outcomes — reliability curves. */
export class ConvictionCalibrationEngine {
  private readonly decisionEngine = new LiveDecisionEngine();

  analyze(signals: SignalSnapshot[]): ConvictionCalibrationReport {
    const evaluated = evaluatedSignals(signals);
    const baselineExpectancyR = computeExpectancyR(evaluated);
    const buckets = new Map<ConvictionBand, SignalSnapshot[]>();

    for (const s of evaluated) {
      const ctx = contextFromSignal(s, evaluated.length);
      const band = this.decisionEngine.decide(ctx).conviction.band;
      buckets.set(band, [...(buckets.get(band) ?? []), s]);
    }

    const expectedOrder = ['ELITE', 'HIGH', 'MODERATE', 'LOW', 'AVOID'];
    const points: ConvictionCalibrationPoint[] = BANDS.map(band => {
      const bucket = buckets.get(band) ?? [];
      const exp = computeExpectancyR(bucket);
      const idx = expectedOrder.indexOf(band);
      const idealExp = baselineExpectancyR * (1 - idx * 0.35);
      const delta = round2(exp - idealExp);

      let reliability: ConvictionCalibrationPoint['reliability'] = 'INSUFFICIENT';
      if (bucket.length >= 10) {
        if (delta < -0.4) reliability = 'OVERSTATED';
        else if (delta > 0.4) reliability = 'UNDERSTATED';
        else reliability = 'ALIGNED';
      }

      return {
        band,
        sampleCount: bucket.length,
        winRate: pct(bucket.filter(s => s.evaluation!.status === 'WIN').length, bucket.length),
        expectancyR: exp,
        calibrationDeltaR: delta,
        reliability,
        confidence: confidenceFromCount(bucket.length)
      };
    }).sort((a, b) => b.expectancyR - a.expectancyR);

    return { points, baselineExpectancyR: round2(baselineExpectancyR), advisoryOnly: true };
  }
}
