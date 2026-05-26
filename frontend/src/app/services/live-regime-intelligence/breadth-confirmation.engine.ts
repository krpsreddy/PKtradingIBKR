import { LiveRegimeInput } from './live-regime.models';
import { clamp } from './live-regime.util';

/** Breadth + sector relative strength confirmation. */
export class BreadthConfirmationEngine {
  institutionalParticipationScore(input: LiveRegimeInput): number {
    const breadth = input.breadthAlignment ?? input.trendAlignment ?? 0;
    const sector = input.sectorRelativeStrength ?? breadth;
    let score = 35;
    if (breadth >= 70) score += 25;
    else if (breadth >= 55) score += 18;
    else if (breadth >= 45) score += 10;
    if (sector >= 65) score += 18;
    else if (sector >= 50) score += 10;
    if (input.marketRegime === 'TREND' || input.marketRegime === 'BREAKOUT') score += 12;
    if (input.marketRegime === 'CHOP' || input.marketRegime === 'CHOPPY') score -= 18;
    return clamp(score);
  }

  aligned(input: LiveRegimeInput): boolean {
    return (input.breadthAlignment ?? input.trendAlignment ?? 0) >= 50;
  }
}
