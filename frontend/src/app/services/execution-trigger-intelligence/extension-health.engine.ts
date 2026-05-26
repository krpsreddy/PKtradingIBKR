import { ExecutionTriggerInput } from './execution-trigger.models';
import { clamp } from './execution-trigger.util';

/** Extension still healthy when acceleration intact. */
export class ExtensionHealthEngine {
  extensionHealth(input: ExecutionTriggerInput): number {
    const rvol = input.rvol ?? 0;
    const structure = input.structureScore ?? input.trendAlignment ?? 0;
    const vwap = input.vwapDistance ?? 0;
    let score = 40;
    if (!input.extended) score += 25;
    else if (rvol >= 2.5 && structure >= 58) score += 22;
    else if (rvol >= 2 && structure >= 52) score += 12;
    else score -= 10;
    if (vwap >= 0 && vwap < 0.035) score += 15;
    if (vwap > 0.05) score -= 15;
    return clamp(score);
  }
}
