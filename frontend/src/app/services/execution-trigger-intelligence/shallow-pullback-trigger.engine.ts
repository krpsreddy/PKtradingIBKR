import { ExecutionTriggerInput } from './execution-trigger.models';
import { clamp } from './execution-trigger.util';

/** Shallow pullback trigger — no deep PB required. */
export class ShallowPullbackTriggerEngine {
  pullbackEfficiency(input: ExecutionTriggerInput): number {
    const depth = input.pullbackDepth ?? Math.abs(input.vwapDistance ?? 0);
    const vwap = input.vwapDistance ?? 0;
    let score = 28;
    if (depth < 0.005) score += 28;
    else if (depth < 0.01) score += 22;
    else if (depth < 0.018) score += 15;
    else if (depth < 0.028) score += 8;
    if (vwap >= 0) score += 15;
    if ((input.rvol ?? 0) >= 1.8) score += 12;
    if (depth > 0.04) score -= 22;
    return clamp(score);
  }

  score(input: ExecutionTriggerInput): number {
    return this.pullbackEfficiency(input);
  }

  qualifies(input: ExecutionTriggerInput): boolean {
    return this.score(input) >= 60;
  }
}
