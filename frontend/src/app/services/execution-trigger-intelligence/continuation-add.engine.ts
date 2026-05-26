import { ExecutionTriggerInput } from './execution-trigger.models';
import { clamp } from './execution-trigger.util';

/** Continuation add on stacked momentum. */
export class ContinuationAddEngine {
  score(input: ExecutionTriggerInput): number {
    const rvol = input.rvol ?? 0;
    const structure = input.structureScore ?? input.trendAlignment ?? 0;
    let score = 25;
    if (rvol >= 3) score += 25;
    else if (rvol >= 2.2) score += 18;
    else if (rvol >= 1.8) score += 12;
    if (structure >= 65) score += 20;
    else if (structure >= 52) score += 12;
    if ((input.vwapDistance ?? 0) >= 0) score += 10;
    if (input.extended && rvol >= 2.5 && structure >= 58) score += 8;
    return clamp(score);
  }

  qualifies(input: ExecutionTriggerInput): boolean {
    return this.score(input) >= 65;
  }
}
