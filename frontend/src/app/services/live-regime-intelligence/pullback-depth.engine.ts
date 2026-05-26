import { LiveRegimeInput } from './live-regime.models';
import { clamp } from './live-regime.util';

/** Shallow pullback quality — persistence matters more than ideal geometry. */
export class PullbackDepthEngine {
  shallowPullbackQuality(input: LiveRegimeInput): number {
    const depth = input.pullbackDepth ?? Math.abs(input.vwapDistance ?? 0);
    let score = 35;
    if (depth < 0.004) score += 30;
    else if (depth < 0.01) score += 25;
    else if (depth < 0.018) score += 18;
    else if (depth < 0.028) score += 8;
    else score -= 15;

    const vwap = input.vwapDistance ?? 0;
    if (vwap >= 0) score += 12;
    if ((input.structureScore ?? 0) >= 55) score += 10;
    if (depth > 0.04) score -= 20;
    return clamp(score);
  }

  qualifies(input: LiveRegimeInput): boolean {
    return this.shallowPullbackQuality(input) >= 58;
  }
}
