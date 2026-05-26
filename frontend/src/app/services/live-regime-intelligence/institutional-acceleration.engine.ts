import { LiveRegimeInput } from './live-regime.models';
import { clamp, inContinuationWindow } from './live-regime.util';

/** Institutional acceleration stacking — do not penalize extension when integrity holds. */
export class InstitutionalAccelerationEngine {
  score(input: LiveRegimeInput): number {
    const rvol = input.rvol ?? 0;
    const structure = input.structureScore ?? input.trendAlignment ?? 0;
    const vwap = input.vwapDistance ?? 0;
    let s = 28;
    if (rvol >= 3) s += 25;
    else if (rvol >= 2) s += 18;
    if (structure >= 65) s += 20;
    else if (structure >= 52) s += 12;
    if (vwap >= 0.008) s += 10;
    if (inContinuationWindow(input.sessionTimeMinutes)) s += 10;
    if (input.extended && rvol >= 2.2 && structure >= 58) s += 8;
    return clamp(s);
  }

  isEarlyAcceleration(input: LiveRegimeInput): boolean {
    return this.score(input) >= 62 && inContinuationWindow(input.sessionTimeMinutes);
  }
}
