import { Injectable } from '@angular/core';

export interface TensionInput {
  rvol: number;
  rangeContracted: boolean;
  triggerProximityPct: number | null;
  breakoutProbability: number;
  momentumAligned: boolean;
  failureMode: boolean;
}

export interface TensionSnapshot {
  score: number;
  volumePulse: number;
  triggerClarity: number;
  liveBoost: number;
  labelSharpness: number;
  chartTightness: number;
  ambientBreathing: number;
  failureBias: number;
  volumeContrast: number;
}

@Injectable({ providedIn: 'root' })
export class LiquidityTensionEngine {
  resolve(input: TensionInput): TensionSnapshot {
    let score = 0;

    if (input.rvol >= 4) score += 35;
    else if (input.rvol >= 2.5) score += 22;
    else if (input.rvol >= 1.5) score += 10;

    if (input.rangeContracted) score += 18;
    if (input.triggerProximityPct != null && input.triggerProximityPct < 0.5) score += 25;
    else if (input.triggerProximityPct != null && input.triggerProximityPct < 1.2) score += 12;

    score += Math.min(20, input.breakoutProbability * 0.2);
    if (input.momentumAligned) score += 10;

    score = Math.min(100, Math.max(0, score));
    const norm = score / 100;

    const tight = input.failureMode
      ? 0.96
      : norm >= 0.6
        ? 1.04 + norm * 0.02
        : norm <= 0.25
          ? 0.92
          : 1;

    return {
      score,
      volumePulse: 0.18 + norm * 0.42,
      triggerClarity: 0.3 + norm * 0.58,
      liveBoost: norm * 0.14,
      labelSharpness: 0.45 + norm * 0.55,
      chartTightness: tight,
      ambientBreathing: norm <= 0.25 ? 1.08 : norm >= 0.55 ? 0.94 : 1,
      failureBias: input.failureMode ? 0.06 : 0,
      volumeContrast: 0.2 + norm * 0.35
    };
  }
}
