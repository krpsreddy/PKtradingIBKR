import { ContinuationParticipationInput } from './continuation-participation.models';

/** VWAP acceptance continuation scoring. */
export class VwapAcceptanceContinuationEngine {
  score(input: ContinuationParticipationInput): number {
    const vwap = input.vwapDistance ?? 0;
    let s = 28;
    if (vwap >= 0 && vwap <= 0.015) s += 28;
    if (vwap >= -0.003 && vwap < 0) s += 18;
    if ((input.rvol ?? 0) >= 2) s += 12;
    if ((input.trendAlignment ?? 0) >= 55) s += 10;
    if (!input.extended) s += 10;
    if (vwap > 0.04) s -= 22;
    return Math.max(0, Math.min(100, s));
  }

  qualifies(input: ContinuationParticipationInput): boolean {
    return this.score(input) >= 52;
  }
}
