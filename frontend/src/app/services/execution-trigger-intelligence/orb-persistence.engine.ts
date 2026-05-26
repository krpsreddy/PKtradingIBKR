import { ExecutionTriggerInput } from './execution-trigger.models';
import { clamp } from './execution-trigger.util';

/** Opening range / early session continuation add. */
export class OrbPersistenceEngine {
  score(input: ExecutionTriggerInput): number {
    const mins = input.sessionTimeMinutes ?? 999;
    if (mins > 45) return 0;
    const rvol = input.rvol ?? 0;
    const structure = input.structureScore ?? input.trendAlignment ?? 0;
    let score = 20;
    if (mins <= 15) score += 18;
    else if (mins <= 30) score += 12;
    if (rvol >= 2.5) score += 22;
    else if (rvol >= 1.8) score += 14;
    if (structure >= 60) score += 18;
    if ((input.vwapDistance ?? 0) >= 0) score += 10;
    return clamp(score);
  }

  qualifies(input: ExecutionTriggerInput): boolean {
    const mins = input.sessionTimeMinutes ?? 999;
    return mins <= 45 && this.score(input) >= 62;
  }
}
