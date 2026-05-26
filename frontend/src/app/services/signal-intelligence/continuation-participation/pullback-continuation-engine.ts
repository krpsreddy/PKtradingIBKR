import { ContinuationParticipationInput } from './continuation-participation.models';

/** Shallow pullback continuation scoring. */
export class PullbackContinuationEngine {
  score(input: ContinuationParticipationInput): number {
    const depth = Math.abs(input.vwapDistance ?? 0);
    let s = 30;
    if (depth < 0.005) s += 25;
    else if (depth < 0.012) s += 18;
    else if (depth < 0.02) s += 10;
    if ((input.rvol ?? 0) >= 1.8) s += 12;
    if ((input.trendAlignment ?? 0) >= 50) s += 10;
    if (!input.extended) s += 12;
    if (depth > 0.035) s -= 20;
    return Math.max(0, Math.min(100, s));
  }

  qualifies(input: ContinuationParticipationInput): boolean {
    return this.score(input) >= 55;
  }
}
