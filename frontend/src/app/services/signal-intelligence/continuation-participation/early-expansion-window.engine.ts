import { ContinuationParticipationInput } from './continuation-participation.models';

/** Early session expansion window participation. */
export class EarlyExpansionWindowEngine {
  score(input: ContinuationParticipationInput): number {
    const mins = input.sessionTimeMinutes ?? 999;
    let s = 25;
    if (mins <= 15) s += 22;
    else if (mins <= 30) s += 18;
    else if (mins <= 60) s += 10;
    if ((input.rvol ?? 0) >= 2.5) s += 15;
    if ((input.trendAlignment ?? 0) >= 55) s += 10;
    if (!input.extended) s += 8;
    if (mins > 120) s -= 15;
    return Math.max(0, Math.min(100, s));
  }

  qualifies(input: ContinuationParticipationInput): boolean {
    return (input.sessionTimeMinutes ?? 999) <= 60 && this.score(input) >= 50;
  }
}
