import { ContinuationPromotionInput } from './continuation-promotion.models';

/** Classify controlled pullback / trend digestion vs breakdown. */
export class PullbackDigestionClassifierEngine {

  classify(input: ContinuationPromotionInput): 'CONTROLLED' | 'DIGESTION' | 'BREAKDOWN' | 'NONE' {
    const pull = input.pullbackStability ?? '';
    const cont = input.continuationAcceptance ?? '';

    if (pull === 'FAILING' || cont === 'FAILING_ACCEPTANCE') return 'BREAKDOWN';
    if (pull === 'VERY_STABLE' || pull === 'STABLE') {
      if (cont === 'WEAK_ACCEPTANCE' || cont === 'NEUTRAL_ACCEPTANCE') return 'DIGESTION';
      return 'CONTROLLED';
    }
    if ((input.trendAlignment ?? 0) >= 55 && !input.extended) return 'DIGESTION';
    return 'NONE';
  }

  supportsPromotion(input: ContinuationPromotionInput): boolean {
    const c = this.classify(input);
    return c === 'CONTROLLED' || c === 'DIGESTION';
  }
}
