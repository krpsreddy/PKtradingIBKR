import {
  EdgeTodaySnapshot,
  ExecutionPlaybookSnapshot,
  LiveExecutionContext,
  OpenTypeSnapshot,
  SuppressionRule
} from './live-execution.models';
import { normalizeRegime, normalizeSetup } from './live-execution-context.util';

/** Generates real-time execution guidance — advisory only. */
export class ExecutionPlaybookEngine {

  build(
    ctx: LiveExecutionContext,
    openType: OpenTypeSnapshot,
    edgeToday: EdgeTodaySnapshot,
    suppressions: SuppressionRule[]
  ): ExecutionPlaybookSnapshot {
    const setup = normalizeSetup(ctx.signalType);
    const regime = normalizeRegime(ctx.marketRegime);

    let bestPlaybook = 'Selective execution on confirmed setups only';
    let avoidPlaybook = 'Avoid low-sample or unconfirmed conditions';
    let waitFor = 'Regime alignment and breadth confirmation';

    if (openType.openType === 'OPENING_FLUSH' && edgeToday.reclaimsWorking) {
      bestPlaybook = 'VWAP reclaim after opening flush';
    } else if (openType.openType === 'TREND_OPEN' && edgeToday.continuationStrongAfter10) {
      bestPlaybook = 'Trend continuation after first pullback';
    } else if (openType.openType === 'RECLAIM_OPEN') {
      bestPlaybook = 'Reclaim confirmation after failed expansion';
    } else if (edgeToday.reclaimsWorking) {
      bestPlaybook = 'VWAP reclaim in aligned breadth';
    }

    if (setup === 'INSTITUTIONAL_ACCELERATION' && regime === 'CHOP') {
      avoidPlaybook = 'Breakout continuation in chop';
    } else if (edgeToday.breakoutsWeak) {
      avoidPlaybook = 'Breakout continuation — failing today';
    } else if (edgeToday.momentumFailing) {
      avoidPlaybook = 'Opening momentum without confirmation';
    } else if (openType.openType === 'TRAP_OPEN') {
      avoidPlaybook = 'Trap open fade-and-chase setups';
    }

    if (openType.openType === 'FAILED_OPEN') {
      waitFor = 'Reclaim confirmation after failed open';
    } else if (openType.openType === 'INSIDE_OPEN') {
      waitFor = 'Range expansion with RVOL confirmation';
    } else if (edgeToday.openingFakeoutsElevated) {
      waitFor = 'Post-open structure clarity — fakeouts elevated';
    } else if (suppressions.some(s => s.severity === 'SUPPRESS')) {
      waitFor = 'Suppression conditions to clear';
    }

    const summary = [bestPlaybook, avoidPlaybook !== 'Avoid low-sample or unconfirmed conditions' ? `Avoid: ${avoidPlaybook}` : null]
      .filter(Boolean)
      .join(' · ');

    return { bestPlaybook, avoidPlaybook, waitFor, summary };
  }
}
