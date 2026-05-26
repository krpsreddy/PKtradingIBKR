import { ExecutionTriggerInput } from './execution-trigger.models';
import { clamp } from './execution-trigger.util';

/** Momentum candle stacking velocity. */
export class MomentumStackEngine {
  continuationVelocity(input: ExecutionTriggerInput): number {
    const rvol = input.rvol ?? 0;
    const structure = input.structureScore ?? input.trendAlignment ?? 0;
    let score = 28;
    if (rvol >= 3.5) score += 28;
    else if (rvol >= 2.5) score += 22;
    else if (rvol >= 2) score += 15;
    if (structure >= 68) score += 22;
    else if (structure >= 55) score += 14;
    if ((input.vwapDistance ?? 0) >= 0.008) score += 10;
    return clamp(score);
  }

  institutionalPressure(input: ExecutionTriggerInput): number {
    const base = this.continuationVelocity(input);
    const regimeBoost = input.marketRegime === 'TREND' || input.marketRegime === 'BREAKOUT' ? 10 : 0;
    return clamp(base * 0.7 + regimeBoost + (input.rvol ?? 0) * 3);
  }

  score(input: ExecutionTriggerInput): number {
    return this.continuationVelocity(input);
  }
}
