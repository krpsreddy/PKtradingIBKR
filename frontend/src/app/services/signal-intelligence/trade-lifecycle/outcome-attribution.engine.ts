import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import {
  FailureAttributionType,
  OutcomeAttributionRow,
  TradeLifecycleSnapshot
} from './trade-lifecycle.models';
import { TradeLifecycleEngine } from './trade-lifecycle.engine';
import { ExitQualityEngine, TradeManagementAnalyticsEngine } from './trade-management-analytics.engine';
import { confidenceFromSamples, realizedR, resolveEntryTiming } from './trade-lifecycle.util';
import { evaluatedSignals } from '../signal-intelligence.math';
import { MarketStateMachineEngine } from '../market-state/market-state-machine.engine';
import { stateLabel } from '../market-state/market-state.util';
import { NarrativeEntryEfficiencyEngine } from '../adaptive-entry/narrative-entry-efficiency.engine';
import { classifyEntryLocation } from '../adaptive-entry/adaptive-entry.util';
import { tradeCalibrationMetrics } from '../adaptive-calibration/adaptive-calibration.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();
const marketStateMachine = new MarketStateMachineEngine();
const entryEfficiencyEngine = new NarrativeEntryEfficiencyEngine();

/** Explain WHY trades succeed or fail — signal vs execution vs management. */
export class OutcomeAttributionEngine {
  private readonly lifecycle = new TradeLifecycleEngine();
  private readonly exitQuality = new ExitQualityEngine();
  private readonly management = new TradeManagementAnalyticsEngine();

  attribute(signal: SignalSnapshot): OutcomeAttributionRow {
    const path = this.lifecycle.buildPath(signal);
    const ev = signal.evaluation;
    const failures = this.detectFailures(signal, path.acceptance);
    const primary = failures[0] ?? null;
    const timing = resolveEntryTiming(signal);
    const signalCorrect = (ev?.mfeR ?? 0) >= 0.75 || ev?.hit1R === true;
    const executionFailed = failures.some(f =>
      f === 'EXECUTION_FAILURE' || f === 'LATE_ENTRY_FAILURE' || f === 'EXHAUSTION_ENTRY'
    );
    const managementFailed = failures.includes('MANAGEMENT_FAILURE');
    const confidence = confidenceFromSamples(1) + (ev?.evaluated ? 15 : 0);

    return {
      signalId: signal.id,
      symbol: signal.symbol,
      signalType: signal.signalType,
      outcome: ev?.status ?? 'OPEN',
      primaryFailure: primary,
      secondaryFailures: failures.slice(1),
      entryTiming: timing,
      signalCorrect,
      executionFailed,
      managementFailed,
      confidence: Math.min(95, confidence),
      summary: this.summarize(signal, primary, signalCorrect, executionFailed, managementFailed)
    };
  }

  buildSnapshot(signal: SignalSnapshot, sampleCount = 1): TradeLifecycleSnapshot {
    const path = this.lifecycle.buildPath(signal);
    const attr = this.attribute(signal);
    const exitQ = this.exitQuality.perTrade(signal);
    const mgmtQ = this.managementScore(signal);
    const calibration = tradeCalibrationMetrics(signal, sampleCount);

    return {
      signalId: signal.id,
      symbol: signal.symbol,
      lifecycleState: path.terminalState,
      continuationHealth: path.continuationHealth,
      executionQuality: this.executionScore(signal, path.acceptance),
      managementQuality: mgmtQ,
      exitQuality: exitQ,
      failureReason: attr.primaryFailure,
      attributionConfidence: attr.confidence,
      lifecycleNotes: this.notes(signal, path, attr),
      entryTiming: path.entryTiming,
      acceptance: path.acceptance,
      path,
      marketStatePath: marketStateMachine.path(signal).states.map(state => ({
        state,
        label: stateLabel(state)
      })),
      entryLocation: classifyEntryLocation(signal),
      entryEfficiencyPct: entryEfficiencyEngine.captureForSignal(signal),
      convictionAccuracy: calibration.convictionAccuracy,
      waitEfficiency: calibration.waitEfficiency,
      suppressionRegret: calibration.suppressionRegret,
      advisoryOnly: true
    };
  }

  attributeAll(signals: SignalSnapshot[]): OutcomeAttributionRow[] {
    return evaluatedSignals(signals)
      .map(s => this.attribute(s))
      .sort((a, b) => b.confidence - a.confidence);
  }

  private detectFailures(signal: SignalSnapshot, acceptance: string): FailureAttributionType[] {
    const ev = signal.evaluation;
    const out: FailureAttributionType[] = [];
    if (!ev?.evaluated || ev.status === 'WIN') return out;

    const timing = resolveEntryTiming(signal);
    if (falseBreakout.isFalseBreakout(signal)) out.push('FAKEOUT_FAILURE');
    if (timing === 'LATE' || timing === 'CHASE') out.push('LATE_ENTRY_FAILURE');
    if (signal.extendedEntry && timing === 'CHASE') out.push('EXHAUSTION_ENTRY');
    if (acceptance === 'REJECTED') out.push('CONTINUATION_DECAY');
    if (signal.trendAlignment < 45 && signal.rvol < 2) out.push('WEAK_BREADTH_FAILURE');
    if ((signal.sessionTimeMinutes ?? 0) <= 15 && signal.signalType === 'BREAKOUT') out.push('OPEN_TYPE_FAILURE');

    const signalWasRight = (ev.mfeR ?? 0) >= 0.8;
    const execBad = timing === 'LATE' || timing === 'CHASE' || signal.extendedEntry;
    const mgmtBad = signalWasRight && realizedR(signal) < ev.mfeR * 0.45;

    if (mgmtBad) out.push('MANAGEMENT_FAILURE');
    else if (execBad && signalWasRight) out.push('EXECUTION_FAILURE');
    else if (!signalWasRight && !execBad) out.push('SIGNAL_FAILURE');
    else if (execBad) out.push('EXECUTION_FAILURE');

    return [...new Set(out)];
  }

  private executionScore(signal: SignalSnapshot, acceptance: string): number {
    let score = 70;
    const timing = resolveEntryTiming(signal);
    if (timing === 'IDEAL') score += 12;
    if (timing === 'EARLY') score += 4;
    if (timing === 'LATE') score -= 18;
    if (timing === 'CHASE') score -= 28;
    if (acceptance === 'ACCEPTED') score += 8;
    if (acceptance === 'REJECTED') score -= 12;
    if (signal.extendedEntry) score -= 10;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private managementScore(signal: SignalSnapshot): number {
    const ev = signal.evaluation;
    if (!ev?.evaluated) return 50;
    const exitQ = this.exitQuality.perTrade(signal);
    let score = exitQ;
    if (ev.hit1R && realizedR(signal) >= 0.8) score += 10;
    if (ev.mfeR >= 1.5 && realizedR(signal) < 0.4) score -= 20;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private notes(
    signal: SignalSnapshot,
    path: ReturnType<TradeLifecycleEngine['buildPath']>,
    attr: OutcomeAttributionRow
  ): string[] {
    const notes: string[] = [];
    const ev = signal.evaluation;
    if (attr.signalCorrect && attr.executionFailed) {
      notes.push('Good signal — late entry reduced expectancy');
    }
    if (path.continuationHealth === 'WEAKENING' || path.continuationHealth === 'FAILING') {
      notes.push('Continuation weakened before exit');
    }
    if (ev && ev.mfeR >= 2 && realizedR(signal) < 1) {
      notes.push(`Exit was premature — trade reached +${ev.mfeR.toFixed(1)}R MFE`);
    }
    if (attr.primaryFailure === 'WEAK_BREADTH_FAILURE') {
      notes.push('Breakout failed due to weak breadth');
    }
    if (attr.primaryFailure === 'FAKEOUT_FAILURE') {
      notes.push('Fakeout — acceptance never sustained');
    }
    return notes;
  }

  private summarize(
    signal: SignalSnapshot,
    primary: FailureAttributionType | null,
    signalCorrect: boolean,
    executionFailed: boolean,
    managementFailed: boolean
  ): string {
    if (signal.evaluation?.status === 'WIN') {
      return signalCorrect ? 'Signal + execution aligned' : 'Win despite weak setup quality';
    }
    if (managementFailed) return 'Management gave back edge after correct signal';
    if (executionFailed && signalCorrect) return 'Signal correct — execution timing failed';
    if (primary) return primary.replace(/_/g, ' ').toLowerCase();
    return 'Mixed outcome — review lifecycle path';
  }
}
