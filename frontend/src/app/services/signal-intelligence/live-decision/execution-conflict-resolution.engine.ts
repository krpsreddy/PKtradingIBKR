import { ConflictResolution, LiveDecisionContext } from './live-decision.models';
import { breadthWeak, extensionPct, fakeoutHigh, isChase } from './live-decision.util';

/** Resolve conflicting execution signals. */
export class ExecutionConflictResolutionEngine {

  resolve(ctx: LiveDecisionContext): ConflictResolution {
    const seq = ctx.sequencingState ?? '';
    const ext = extensionPct(ctx);
    const goodReclaim = seq === 'RECLAIM_CONFIRMED' || seq === 'CONTINUATION_ACCEPTED' || seq === 'SECOND_LEG_CONFIRMED';
    const strongCont = ctx.continuationAcceptance?.includes('STRONG') ?? false;
    const weakBreadth = breadthWeak(ctx);

    if (fakeoutHigh(ctx) || seq === 'FAILED_ACCEPTANCE' || seq === 'LIQUIDITY_SWEEP') return 'AVOID';
    if (goodReclaim && weakBreadth) return 'REDUCE';
    if (strongCont && ext >= 8) return 'REDUCE';
    if (goodReclaim && ctx.continuationAcceptance?.includes('FAILING')) return 'WAIT';
    if (isChase(ctx) && !strongCont) return 'AVOID';
    if (seq === 'WAITING_FOR_ACCEPTANCE' || seq === 'RECLAIM_IN_PROGRESS') return 'WAIT';
    if (goodReclaim && strongCont) return 'PROCEED';
    if (ctx.governanceState === 'TOXIC' || ctx.governanceState === 'SUPPRESS') return 'AVOID';
    return 'REDUCE';
  }
}
