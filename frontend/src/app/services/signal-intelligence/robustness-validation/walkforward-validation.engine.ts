import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { WalkforwardValidationRow } from './robustness-validation.models';
import { avgR, round2, splitWalkforward, winRate } from './robustness-validation.util';

/** First-half train vs second-half test stability. */
export class WalkforwardValidationEngine {
  analyze(strategyName: string, signals: SignalSnapshot[]): WalkforwardValidationRow {
    const { train, test } = splitWalkforward(signals);
    const trainAvgR = train.length ? avgR(train) : 0;
    const testAvgR = test.length ? avgR(test) : 0;
    const trainWinRate = train.length ? winRate(train) : 0;
    const testWinRate = test.length ? winRate(test) : 0;

    const expectancyDecay = trainAvgR > 0
      ? round2(Math.max(0, ((trainAvgR - testAvgR) / trainAvgR) * 100))
      : 0;
    const wrDecay = trainWinRate > 0
      ? round2(Math.max(0, trainWinRate - testWinRate))
      : 0;

    const stable = expectancyDecay < 35 && wrDecay < 20 && testAvgR > 0;

    return {
      strategyName,
      trainAvgR,
      testAvgR,
      trainWinRate,
      testWinRate,
      expectancyDecay,
      wrDecay,
      stable
    };
  }

  decayScore(signals: SignalSnapshot[]): number {
    const w = this.analyze('', signals);
    let score = 80;
    score -= w.expectancyDecay * 0.5;
    score -= w.wrDecay * 0.8;
    if (w.testAvgR <= 0) score -= 25;
    return Math.max(0, Math.min(100, Math.round(score)));
  }
}
