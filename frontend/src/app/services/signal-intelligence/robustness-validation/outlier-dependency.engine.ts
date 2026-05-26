import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { OutlierAnalysisRow } from './robustness-validation.models';
import { avgR, mfeR, round2, trimTopOutliers } from './robustness-validation.util';

/** Top-winner dependency analysis. */
export class OutlierDependencyEngine {
  analyze(strategyName: string, signals: SignalSnapshot[]): OutlierAnalysisRow {
    const fullAvg = avgR(signals);
    const trimmed = trimTopOutliers(signals, 3);
    const trimmedAvg = trimmed.length ? avgR(trimmed) : 0;

    const sorted = signals.slice().sort((a, b) => mfeR(b) - mfeR(a));
    const top3R = sorted.slice(0, 3).reduce((n, s) => n + mfeR(s), 0);
    const totalR = signals.reduce((n, s) => n + mfeR(s), 0);
    const top3ContributionPct = totalR > 0 ? round2((top3R / totalR) * 100) : 0;

    const collapsePct = fullAvg > 0 ? round2(((fullAvg - trimmedAvg) / fullAvg) * 100) : 0;
    const outlierDependent = collapsePct >= 45 || top3ContributionPct >= 55;

    return {
      strategyName,
      fullSampleAvgR: fullAvg,
      trimmedAvgR: trimmedAvg,
      top3ContributionPct,
      outlierDependent,
      collapsePct
    };
  }

  dependencyScore(signals: SignalSnapshot[]): number {
    const o = this.analyze('', signals);
    if (o.outlierDependent) return Math.max(0, 100 - o.collapsePct);
    return Math.min(100, 85 - o.top3ContributionPct * 0.5);
  }
}
