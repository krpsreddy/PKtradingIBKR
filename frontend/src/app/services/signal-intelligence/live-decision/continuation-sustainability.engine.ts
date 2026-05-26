import { ContinuationSustainability, LiveDecisionContext } from './live-decision.models';
import { breadthStrong, breadthWeak, extensionPct, fakeoutHigh, isChase } from './live-decision.util';

/** Estimate how likely continuation survives. */
export class ContinuationSustainabilityEngine {

  evaluate(ctx: LiveDecisionContext): ContinuationSustainability {
    let score = 50;
    const seq = ctx.sequencingState ?? '';

    if (seq === 'SECOND_LEG_CONFIRMED') score += 30;
    else if (seq === 'CONTINUATION_ACCEPTED') score += 22;
    else if (seq === 'RECLAIM_CONFIRMED') score += 14;
    else if (seq === 'EXHAUSTING' || seq === 'FAILED_ACCEPTANCE') score -= 30;

    const cont = ctx.continuationLevel ?? '';
    if (cont.includes('VERY_STRONG') || cont === 'VERY_STRONG') score += 15;
    else if (cont.includes('STRONG')) score += 10;
    else if (cont.includes('FAILING') || cont === 'FAILING') score -= 15;

    if (ctx.pullbackStability === 'VERY_STABLE') score += 12;
    if (ctx.pullbackStability === 'FAILING') score -= 18;
    if (breadthStrong(ctx)) score += 10;
    if (breadthWeak(ctx)) score -= 12;
    if (fakeoutHigh(ctx)) score -= 15;
    if (isChase(ctx) && extensionPct(ctx) >= 6) score -= 12;

    if (score >= 78) return 'VERY_HIGH';
    if (score >= 62) return 'HIGH';
    if (score >= 45) return 'MODERATE';
    if (score >= 28) return 'LOW';
    return 'FAILING';
  }
}
