import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { PullbackStabilityLevel, PullbackStabilityReport } from './entry-sequencing.models';
import { windows, w } from './entry-sequencing.util';

/** Measure pullback orderliness and stability. */
export class PullbackStabilityEngine {

  analyze(signals: SignalSnapshot[]): PullbackStabilityReport {
    const evaluated = evaluatedSignals(signals);
    const levels: PullbackStabilityLevel[] = ['VERY_STABLE', 'STABLE', 'UNSTABLE', 'FAILING'];
    const byLevel = levels.map(level => {
      const bucket = evaluated.filter(s => this.classify(s) === level);
      const contSurv = bucket.filter(s => (s.evaluation?.mfeR ?? 0) >= 0.8);
      return {
        level,
        sampleCount: bucket.length,
        expectancyR: bucket.length ? computeExpectancyR(bucket) : 0,
        continuationSurvival: bucket.length ? pct(contSurv.length, bucket.length) : 0
      };
    }).filter(r => r.sampleCount > 0);

    const dominant = byLevel.sort((a, b) => b.sampleCount - a.sampleCount)[0];

    return {
      level: dominant?.level ?? 'STABLE',
      sampleCount: evaluated.length,
      expectancyR: evaluated.length ? computeExpectancyR(evaluated) : 0,
      continuationSurvival: evaluated.length
        ? pct(evaluated.filter(s => (s.evaluation?.mfeR ?? 0) >= 0.8).length, evaluated.length)
        : 0,
      byLevel,
      advisoryOnly: true
    };
  }

  classify(s: SignalSnapshot): PullbackStabilityLevel {
    const m5 = w(windows(s).w5);
    const m15 = w(windows(s).w15);
    const mae = Math.abs(s.evaluation?.maeR ?? m5.mae);
    const vol = s.volatility ?? 0;

    if (mae >= 0.8 || m5.mae < -0.75) return 'FAILING';
    if (mae >= 0.55 || (m5.mae < -0.5 && m15.mfe < 0.2)) return 'UNSTABLE';
    if (mae <= 0.35 && m15.mfe >= m5.mfe && vol < 0.025) return 'VERY_STABLE';
    if (mae <= 0.5 && m5.mae > -0.45) return 'STABLE';
    return 'UNSTABLE';
  }
}
