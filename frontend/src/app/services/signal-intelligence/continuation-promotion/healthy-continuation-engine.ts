import { ContinuationPromotionInput } from './continuation-promotion.models';
import { isReclaimSignal, isSecondLegSignal } from './continuation-promotion.util';

/** Detect institutional continuation conditions (pre-expansion, not post-hindsight). */
export class HealthyContinuationEngine {

  score(input: ContinuationPromotionInput): number {
    let score = 0;
    const cont = input.continuationAcceptance ?? '';
    const pull = input.pullbackStability ?? '';
    const seq = input.sequencingState ?? '';

    if (cont === 'WEAK_ACCEPTANCE' || cont === 'NEUTRAL_ACCEPTANCE') score += 18;
    if (cont === 'STRONG_ACCEPTANCE' || cont === 'VERY_STRONG_ACCEPTANCE') score += 28;
    if (pull === 'STABLE' || pull === 'VERY_STABLE') score += 22;
    if (seq === 'SECOND_LEG_CONFIRMED' || seq === 'CONTINUATION_ACCEPTED') score += 25;
    if (seq === 'RECLAIM_CONFIRMED' || seq === 'PULLBACK_STABILIZING') score += 20;
    if (isReclaimSignal(input)) score += 15;
    if (isSecondLegSignal(input)) score += 20;
    if ((input.trendAlignment ?? 0) >= 55) score += 12;
    if ((input.rvol ?? 0) >= 1.5 && (input.rvol ?? 0) <= 5) score += 10;
    if (input.vwapDistance != null && input.vwapDistance >= -0.005 && input.vwapDistance <= 0.02) score += 12;
    if (input.fakeoutRisk === 'LOW') score += 10;
    if (input.extended) score -= 25;

    return score;
  }

  isHealthy(input: ContinuationPromotionInput): boolean {
    return this.score(input) >= 45;
  }
}
