import { ExecutionTriggerInput } from './execution-trigger.models';
import { clamp } from './execution-trigger.util';

/** Candle compression tightness — brief digestion before resume. */
export class MicroCompressionEngine {
  compressionEnergy(input: ExecutionTriggerInput): number {
    const vol = input.volatility ?? 0.02;
    const depth = input.pullbackDepth ?? Math.abs(input.vwapDistance ?? 0);
    const rvol = input.rvol ?? 0;
    let score = 30;
    if (vol < 0.015) score += 22;
    else if (vol < 0.025) score += 15;
    else if (vol < 0.035) score += 8;
    if (depth < 0.012) score += 20;
    else if (depth < 0.022) score += 12;
    if (rvol >= 2 && (input.trendAlignment ?? 0) >= 55) score += 15;
    return clamp(score);
  }

  qualifies(input: ExecutionTriggerInput): boolean {
    return this.compressionEnergy(input) >= 58;
  }
}
