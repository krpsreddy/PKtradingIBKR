import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { ConvictionBand } from '../live-decision/live-decision.models';
import { ConvictionCalibrationReport, ConvictionCalibrationRow } from './adaptive-calibration.models';
import {
  contextFromSignal,
  EXPECTED_R_BY_BAND,
  isFakeout,
  continuationAchieved,
  realizedR,
  round2
} from './adaptive-calibration.util';
import { LiveDecisionEngine } from '../live-decision/live-decision-engine';

const BANDS: ConvictionBand[] = ['ELITE', 'HIGH', 'MODERATE', 'LOW', 'AVOID'];

/** Measure expected vs actual outcome by conviction band. */
export class ConvictionCalibrationEngine {
  private readonly decisionEngine = new LiveDecisionEngine();

  analyze(signals: SignalSnapshot[]): ConvictionCalibrationReport {
    const evaluated = evaluatedSignals(signals);
    const baselineExpectancyR = computeExpectancyR(evaluated);
    const buckets = new Map<ConvictionBand, SignalSnapshot[]>();

    for (const s of evaluated) {
      const band = this.decisionEngine.decide(contextFromSignal(s, evaluated.length)).conviction.band;
      buckets.set(band, [...(buckets.get(band) ?? []), s]);
    }

    const rows: ConvictionCalibrationRow[] = BANDS.map(band => {
      const bucket = buckets.get(band) ?? [];
      const actualR = computeExpectancyR(bucket);
      const expectedR = EXPECTED_R_BY_BAND[band];
      const delta = round2(actualR - expectedR);

      let reliability: ConvictionCalibrationRow['reliability'] = 'INSUFFICIENT';
      if (bucket.length >= 10) {
        if (delta < -0.35) reliability = 'OVERSTATED';
        else if (delta > 0.35) reliability = 'UNDERSTATED';
        else reliability = 'ALIGNED';
      }

      const regrets = bucket.filter(s => {
        const r = realizedR(s);
        return (band === 'HIGH' || band === 'ELITE') && r < expectedR * 0.4;
      });

      return {
        band,
        sampleCount: bucket.length,
        winRate: pct(bucket.filter(s => s.evaluation!.status === 'WIN').length, bucket.length),
        expectancyR: actualR,
        expectedR,
        actualR,
        continuationRate: pct(bucket.filter(continuationAchieved).length, bucket.length),
        fakeoutRate: pct(bucket.filter(isFakeout).length, bucket.length),
        regretRate: pct(regrets.length, bucket.length),
        reliability,
        confidence: confidenceFromCount(bucket.length)
      };
    }).sort((a, b) => b.expectancyR - a.expectancyR);

    return { rows, baselineExpectancyR: round2(baselineExpectancyR), advisoryOnly: true };
  }
}
