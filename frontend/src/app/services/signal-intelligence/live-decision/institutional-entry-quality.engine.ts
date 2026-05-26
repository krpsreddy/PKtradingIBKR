import { InstitutionalEntryQuality, LiveDecisionContext } from './live-decision.models';
import { breadthStrong, extensionPct, isChase, isLate } from './live-decision.util';

/** Classify institutional vs retail entry quality. */
export class InstitutionalEntryQualityEngine {

  classify(ctx: LiveDecisionContext): InstitutionalEntryQuality {
    const seq = ctx.sequencingState ?? '';
    const ext = extensionPct(ctx);

    if (seq === 'SECOND_LEG_CONFIRMED') return 'SECOND_LEG_ACCEPTANCE';
    if (seq === 'CONTINUATION_ACCEPTED' && breadthStrong(ctx)) return 'CONFIRMED_CONTINUATION';
    if (seq === 'RECLAIM_CONFIRMED' || (ctx.signalType === 'VWAP_RECLAIM' && seq !== 'FAILED_ACCEPTANCE')) {
      return 'INSTITUTIONAL_RECLAIM';
    }
    if (seq === 'EXHAUSTING') return 'EXHAUSTED_ENTRY';
    if (isLate(ctx) && ctx.signalType === 'BREAKOUT') return 'LATE_BREAKOUT';
    if (isChase(ctx) && ext >= 8) return 'EMOTIONAL_EXTENSION';
    if (isChase(ctx)) return 'RETAIL_CHASE';
    if (seq === 'INITIAL_TRIGGER' || seq === 'EARLY_EXTENSION') return 'EARLY_PROBE';
    return 'EARLY_PROBE';
  }
}
