import { ExecutionTimingDecision, LiveDecisionContext } from './live-decision.models';
import { extensionPct, isChase, isLate } from './live-decision.util';

/** Determine when to enter — NOW vs wait states. */
export class ExecutionTimingDecisionEngine {

  decide(ctx: LiveDecisionContext): ExecutionTimingDecision {
    const seq = ctx.sequencingState ?? '';
    const ext = extensionPct(ctx);

    if (isLate(ctx) || (isChase(ctx) && ext >= 8)) return 'TOO_LATE';

    if (seq === 'SECOND_LEG_CONFIRMED') return 'NOW';
    if (seq === 'CONTINUATION_ACCEPTED' || seq === 'RECLAIM_CONFIRMED') {
      if (ctx.pullbackStability === 'VERY_STABLE' || ctx.pullbackStability === 'STABLE') return 'NOW';
      return 'WAIT_FOR_PULLBACK';
    }

    if (seq === 'PULLBACK_STABILIZING') return 'WAIT_FOR_SECOND_LEG';
    if (seq === 'RECLAIM_IN_PROGRESS' || seq === 'WAITING_FOR_ACCEPTANCE') return 'WAIT_FOR_HOLD';
    if (seq === 'EARLY_EXTENSION' || seq === 'INITIAL_TRIGGER') return 'WAIT_FOR_HOLD';

    if (ext >= 5 && !ctx.continuationAcceptance?.includes('STRONG')) return 'WAIT_FOR_PULLBACK';
    if (ctx.continuationAcceptance?.includes('STRONG')) return 'NOW';

    return 'WAIT_FOR_HOLD';
  }
}
