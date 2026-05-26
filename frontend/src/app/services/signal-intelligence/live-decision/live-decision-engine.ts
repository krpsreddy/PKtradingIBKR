import {
  LiveDecisionContext,
  LiveExecutionDecision,
  LiveExecutionDecisionSnapshot
} from './live-decision.models';
import { ExecutionConvictionEngine } from './execution-conviction.engine';
import { ExecutionTimingDecisionEngine } from './execution-timing-decision.engine';
import { ContinuationSustainabilityEngine } from './continuation-sustainability.engine';
import { ExecutionConflictResolutionEngine } from './execution-conflict-resolution.engine';
import { InstitutionalEntryQualityEngine } from './institutional-entry-quality.engine';
import {
  breadthWeak,
  extensionPct,
  fakeoutHigh,
  governanceToxic,
  isChase,
  isLate,
  MIN_AUTHORITATIVE,
  riskLabel,
  timingLabel
} from './live-decision.util';
import { isIdealLocation, isPoorLocation } from '../adaptive-entry/adaptive-entry.util';

/** Primary orchestrator — ONE institutional execution decision. */
export class LiveDecisionEngine {
  private readonly convictionEngine = new ExecutionConvictionEngine();
  private readonly timingEngine = new ExecutionTimingDecisionEngine();
  private readonly sustainabilityEngine = new ContinuationSustainabilityEngine();
  private readonly conflictEngine = new ExecutionConflictResolutionEngine();
  private readonly entryQualityEngine = new InstitutionalEntryQualityEngine();

  decide(ctx: LiveDecisionContext): LiveExecutionDecisionSnapshot {
    const conviction = this.convictionEngine.score(ctx);
    const timing = this.timingEngine.decide(ctx);
    const sustainability = this.sustainabilityEngine.evaluate(ctx);
    const entryQuality = this.entryQualityEngine.classify(ctx);
    const conflict = this.conflictEngine.resolve(ctx);
    const decision = this.resolveDecision(ctx, conviction.score, timing, conflict, sustainability);
    const keyReason = this.keyReason(ctx, decision, entryQuality, sustainability);
    const risk = riskLabel(ctx);
    const decisionLabel = this.decisionDisplay(decision);
    const compactLine = `${decisionLabel} · ${conviction.label}`;
    const detailLine = `${keyReason} · ${risk}`;

    return {
      decision,
      decisionLabel,
      conviction,
      timing,
      timingLabel: timingLabel(timing),
      sustainability,
      entryQuality,
      conflictResolution: conflict,
      keyReason,
      riskLabel: risk,
      compactLine,
      detailLine,
      authoritative: (ctx.sampleCount ?? 0) >= MIN_AUTHORITATIVE,
      advisoryOnly: true
    };
  }

  private resolveDecision(
    ctx: LiveDecisionContext,
    conviction: number,
    timing: ReturnType<ExecutionTimingDecisionEngine['decide']>,
    conflict: ReturnType<ExecutionConflictResolutionEngine['resolve']>,
    sustainability: ReturnType<ContinuationSustainabilityEngine['evaluate']>
  ): LiveExecutionDecision {
    const seq = ctx.sequencingState ?? '';

    if (governanceToxic(ctx) || seq === 'LIQUIDITY_SWEEP' || seq === 'FAILED_ACCEPTANCE') {
      return fakeoutHigh(ctx) ? 'TRAP_RISK' : 'AVOID_TRADE';
    }
    if (conflict === 'AVOID') {
      return isChase(ctx) ? 'AVOID_CHASE' : fakeoutHigh(ctx) ? 'TRAP_RISK' : 'AVOID_TRADE';
    }
    if (conflict === 'WAIT' || timing === 'WAIT_FOR_HOLD') return 'WAIT_FOR_ACCEPTANCE';
    if (timing === 'WAIT_FOR_PULLBACK') return 'WAIT_FOR_PULLBACK';
    if (timing === 'WAIT_FOR_SECOND_LEG') return 'WAIT_FOR_ACCEPTANCE';
    if (timing === 'TOO_LATE') return isChase(ctx) ? 'AVOID_CHASE' : 'REDUCE_SIZE';
    if (ctx.entryLocationQuality && isPoorLocation(ctx.entryLocationQuality)) {
      return ctx.entryLocationQuality === 'TRAP_LOCATION' ? 'TRAP_RISK' : 'AVOID_CHASE';
    }
    if (ctx.entryLocationQuality && !isIdealLocation(ctx.entryLocationQuality) && (ctx.narrativeQuality ?? 50) >= 55) {
      if (ctx.waitJustified) return 'WAIT_FOR_PULLBACK';
      if (ctx.governanceTooConservative && ctx.narrativeStable) return 'PROBING_EXECUTION';
      return 'WAIT_FOR_PULLBACK';
    }
    if (ctx.calibratedConvictionBias === 'OVERSTATED' && conviction >= 55) {
      return 'REDUCE_SIZE';
    }
    if (ctx.governanceTooConservative && ctx.narrativeStable && conviction >= 60 && sustainability !== 'FAILING') {
      if (ctx.entryLocationQuality && isIdealLocation(ctx.entryLocationQuality)) return 'FULL_EXECUTION';
      return 'PROBING_EXECUTION';
    }
    if (conflict === 'REDUCE' || sustainability === 'LOW' || extensionPct(ctx) >= 7) return 'REDUCE_SIZE';
    if (isChase(ctx) && !ctx.continuationAcceptance?.includes('STRONG')) return 'AVOID_CHASE';
    if (breadthWeak(ctx) && sustainability === 'FAILING') return 'AVOID_TRADE';
    if (conviction >= 75 && sustainability !== 'FAILING') {
      const calibratedOk = ctx.calibratedConvictionBias !== 'OVERSTATED'
        && (ctx.narrativeStable !== false)
        && (ctx.lowRegretZone !== false || (ctx.calibrationRegretScore ?? 50) < 45);
      if (!calibratedOk) return 'REDUCE_SIZE';
      if (ctx.entryLocationQuality && isIdealLocation(ctx.entryLocationQuality)) return 'FULL_EXECUTION';
      if (ctx.entryLocationQuality && !isPoorLocation(ctx.entryLocationQuality)) return 'FULL_EXECUTION';
      return 'WAIT_FOR_ACCEPTANCE';
    }
    if (conviction >= 55) return 'PROBING_EXECUTION';
    if (conviction >= 40) return 'REDUCE_SIZE';
    return 'AVOID_TRADE';
  }

  private decisionDisplay(d: LiveExecutionDecision): string {
    switch (d) {
      case 'FULL_EXECUTION': return 'FULL EXECUTION';
      case 'PROBING_EXECUTION': return 'PROBING EXECUTION';
      case 'WAIT_FOR_ACCEPTANCE': return 'WAIT FOR ACCEPTANCE';
      case 'WAIT_FOR_PULLBACK': return 'WAIT FOR PULLBACK';
      case 'REDUCE_SIZE': return 'REDUCE SIZE';
      case 'AVOID_CHASE': return 'AVOID CHASE';
      case 'AVOID_TRADE': return 'AVOID TRADE';
      case 'TRAP_RISK': return 'TRAP RISK';
    }
  }

  private keyReason(
    ctx: LiveDecisionContext,
    decision: LiveExecutionDecision,
    entryQuality: ReturnType<InstitutionalEntryQualityEngine['classify']>,
    sustainability: ReturnType<ContinuationSustainabilityEngine['evaluate']>
  ): string {
    if (decision === 'FULL_EXECUTION') {
      return entryQuality === 'INSTITUTIONAL_RECLAIM'
        ? 'Institutional reclaim accepted.'
        : 'Reclaim stabilized with strong continuation.';
    }
    if (decision === 'WAIT_FOR_ACCEPTANCE') return 'Momentum extension not yet accepted.';
    if (decision === 'WAIT_FOR_PULLBACK') return 'Wait for pullback stabilization.';
    if (decision === 'REDUCE_SIZE') return 'Good continuation · high extension — size down.';
    if (decision === 'AVOID_CHASE') return 'Emotional extension — avoid chase.';
    if (decision === 'TRAP_RISK') return 'Trap risk elevated — do not enter.';
    if (decision === 'AVOID_TRADE') return breadthWeak(ctx)
      ? 'Weak breadth continuation failing.'
      : 'Low conviction — avoid trade.';
    if (decision === 'PROBING_EXECUTION') return 'Moderate conviction — probe size only.';
    if (isLate(ctx)) return 'Late relative to impulse — reduced edge.';
    return `Continuation sustainability ${sustainability.replace(/_/g, ' ').toLowerCase()}.`;
  }
}
