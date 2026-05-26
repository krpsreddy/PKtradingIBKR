import { ContinuationParticipationInput } from './continuation-participation.models';

/** Continuation add-on scoring after structure established. */
export class ContinuationAddEngine {
  score(input: ContinuationParticipationInput): number {
    let s = 32;
    if ((input.trendAlignment ?? 0) >= 60) s += 15;
    if ((input.rvol ?? 0) >= 2 && (input.rvol ?? 0) <= 8) s += 12;
    if ((input.vwapDistance ?? 0) >= -0.005) s += 12;
    if (!input.extended) s += 10;
    if ((input.convictionScore ?? 0) >= 60) s += 8;
    if (input.extended && (input.vwapDistance ?? 0) > 0.025) s -= 20;
    return Math.max(0, Math.min(100, s));
  }
}
