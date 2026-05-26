import { ExecutionTriggerInput } from './execution-trigger.models';
import { clamp, vwapPersistenceMinutes } from './execution-trigger.util';

/** VWAP hold continuation trigger. */
export class VwapPersistenceTriggerEngine {
  score(input: ExecutionTriggerInput): number {
    const vwap = input.vwapDistance ?? 0;
    const persist = vwapPersistenceMinutes(input);
    let score = 25;
    if (vwap >= 0) score += 20;
    if (vwap >= 0.004 && vwap < 0.025) score += 15;
    if (persist >= 30) score += 22;
    else if (persist >= 15) score += 14;
    if ((input.rvol ?? 0) >= 2) score += 12;
    return clamp(score);
  }

  qualifies(input: ExecutionTriggerInput): boolean {
    return this.score(input) >= 62 && (input.vwapDistance ?? 0) >= 0;
  }
}
