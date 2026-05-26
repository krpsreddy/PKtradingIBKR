import { ExecutionTriggerInput } from './execution-trigger.models';
import { clamp } from './execution-trigger.util';

/** Late-stage exhaustion drift detection. */
export class LateStageExhaustionEngine {
  exhaustionDrift(input: ExecutionTriggerInput): number {
    let risk = 18;
    if (input.extended && (input.rvol ?? 0) < 1.5) risk += 28;
    if ((input.vwapDistance ?? 0) > 0.045) risk += 20;
    if (input.marketRegime === 'CHOP' || input.marketRegime === 'CHOPPY') risk += 15;
    const structure = input.structureScore ?? input.trendAlignment ?? 0;
    if (structure < 45) risk += 18;
    if ((input.rvol ?? 0) >= 2.5 && structure >= 58) risk -= 12;
    return clamp(risk);
  }

  isExhaustion(input: ExecutionTriggerInput): boolean {
    return this.exhaustionDrift(input) >= 68;
  }

  isDoNotChase(input: ExecutionTriggerInput): boolean {
    return this.exhaustionDrift(input) >= 75 || ((input.vwapDistance ?? 0) > 0.05 && (input.rvol ?? 0) < 1.8);
  }
}
