import { ConvictionBand, ExecutionConvictionSnapshot, LiveDecisionContext } from './live-decision.models';
import {
  breadthStrong,
  breadthWeak,
  extensionPct,
  fakeoutHigh,
  governanceAllow,
  governanceToxic,
  isChase,
  isLate
} from './live-decision.util';

/** Institutional conviction scoring 0–100. */
export class ExecutionConvictionEngine {

  score(ctx: LiveDecisionContext): ExecutionConvictionSnapshot {
    let score = 55;

    const seq = ctx.sequencingState ?? '';
    if (seq === 'SECOND_LEG_CONFIRMED' || seq === 'CONTINUATION_ACCEPTED') score += 22;
    else if (seq === 'RECLAIM_CONFIRMED' || seq === 'PULLBACK_STABILIZING') score += 14;
    else if (seq === 'WAITING_FOR_ACCEPTANCE' || seq === 'RECLAIM_IN_PROGRESS') score -= 8;
    else if (seq === 'FAILED_ACCEPTANCE' || seq === 'EXHAUSTING') score -= 28;

    const cont = ctx.continuationAcceptance ?? '';
    if (cont.includes('VERY_STRONG')) score += 12;
    else if (cont.includes('STRONG')) score += 8;
    else if (cont.includes('FAILING') || cont.includes('WEAK')) score -= 12;

    const pb = ctx.pullbackStability ?? '';
    if (pb === 'VERY_STABLE' || pb === 'STABLE') score += 8;
    if (pb === 'FAILING' || pb === 'UNSTABLE') score -= 10;

    if (breadthStrong(ctx)) score += 10;
    if (breadthWeak(ctx)) score -= 14;
    if (fakeoutHigh(ctx)) score -= 18;
    if (governanceAllow(ctx)) score += 8;
    if (governanceToxic(ctx)) score -= 25;
    if (isChase(ctx)) score -= 16;
    if (isLate(ctx)) score -= 10;
    if (extensionPct(ctx) >= 8) score -= 12;
    if ((ctx.governanceConfidence ?? 0) >= 70) score += 6;

    score = Math.round(Math.max(0, Math.min(100, score)));
    const band = this.band(score);

    return {
      score,
      band,
      label: `${band} CONVICTION ${score}%`,
      advisoryOnly: true
    };
  }

  band(score: number): ConvictionBand {
    if (score >= 90) return 'ELITE';
    if (score >= 75) return 'HIGH';
    if (score >= 60) return 'MODERATE';
    if (score >= 40) return 'LOW';
    return 'AVOID';
  }
}
