import { LiveRegimeInput } from './live-regime.models';
import { clamp, inContinuationWindow } from './live-regime.util';

/** Expansion probability before full move completes. */
export class ExpansionProbabilityEngine {
  score(
    persistence: number,
    acceleration: number,
    shallowPb: number,
    institutional: number,
    input: LiveRegimeInput
  ): number {
    let prob = persistence * 0.3 + acceleration * 0.25 + shallowPb * 0.2 + institutional * 0.25;
    if (inContinuationWindow(input.sessionTimeMinutes)) prob += 8;
    if ((input.rvol ?? 0) >= 2.5) prob += 6;
    if (input.marketRegime === 'CHOP' || input.marketRegime === 'CHOPPY') prob -= 15;
    return clamp(prob);
  }

  exhaustionProbability(
    persistence: number,
    acceleration: number,
    input: LiveRegimeInput
  ): number {
    let risk = 20;
    if (input.extended && (input.rvol ?? 0) < 1.5) risk += 25;
    if (acceleration < 40 && persistence < 45) risk += 20;
    if (input.marketRegime === 'CHOP' || input.marketRegime === 'CHOPPY') risk += 18;
    if ((input.vwapDistance ?? 0) > 0.045) risk += 15;
    if (persistence >= 70 && acceleration >= 60) risk -= 15;
    return clamp(risk);
  }
}
