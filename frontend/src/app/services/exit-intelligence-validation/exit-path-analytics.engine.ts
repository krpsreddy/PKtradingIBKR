import { Candle } from '../../models/candle.model';
import { ExecutionPlan } from '../execution-plan/execution-plan.models';
import { persistenceContinuationOverride } from '../autonomous-execution-templates/template-calibration.util';
import { ExitPathAnalytics } from './exit-intelligence-validation.models';

export interface ExitPathInput {
  direction: 'LONG' | 'SHORT';
  entry: number;
  stop: number;
  target?: number;
  candles: Candle[];
  startIdx: number;
  planPersistence: number;
  planExhaustion: number;
  vwap?: number;
}

/** Deterministic exit path + post-exit continuation (no plan logic changes). */
export function analyzeExitPath(input: ExitPathInput): ExitPathAnalytics | null {
  const { candles, startIdx } = input;
  if (startIdx < 0 || startIdx >= candles.length) return null;

  const risk = Math.abs(input.entry - input.stop);
  if (risk <= 0) return null;

  const future = candles.slice(startIdx);
  if (!future.length) return null;

  const holdOverride = persistenceContinuationOverride({
    price: input.entry,
    conviction: 55,
    expansionProbability: 55,
    continuationPersistence: input.planPersistence,
    exhaustionProbability: input.planExhaustion,
    triggerIntegrity: 52,
    institutionalPressure: input.planPersistence,
    executionQuality: 50,
    relativeVolume: 1.4,
    extended: false
  });

  let maxPrice = input.entry;
  let minPrice = input.entry;
  let exitBarIndex = future.length - 1;
  let exitReason: ExitPathAnalytics['exitReason'] = 'TIMEOUT';
  let exitR = 0;
  let resolved = false;

  for (let i = 0; i < future.length; i++) {
    const c = future[i];
    maxPrice = Math.max(maxPrice, c.high);
    minPrice = Math.min(minPrice, c.low);

    const favorable = input.direction === 'LONG' ? c.high - input.entry : input.entry - c.low;
    const stopHit = input.direction === 'LONG' ? c.low <= input.stop : c.high >= input.stop;
    const tgtHit = input.target != null
      && (input.direction === 'LONG' ? c.high >= input.target : c.low <= input.target);

    if (!resolved) {
      if (stopHit) {
        exitReason = 'STOP';
        exitBarIndex = i;
        exitR = -1;
        resolved = true;
      } else if (tgtHit) {
        exitReason = 'TARGET';
        exitBarIndex = i;
        exitR = input.target != null ? Math.abs(input.target - input.entry) / risk : 1;
        resolved = true;
      } else if (favorable >= risk && input.target == null) {
        exitReason = 'TARGET';
        exitBarIndex = i;
        exitR = 1;
        resolved = true;
      }
    }
  }

  if (!resolved) {
    exitR = favorableAtClose(input, future[future.length - 1]) / risk;
  }

  const peakMfeR = mfeR(input.direction, input.entry, maxPrice, minPrice, risk);
  const retainedMfePct = peakMfeR > 0
    ? Math.round(Math.min(100, Math.max(0, (Math.max(0, exitR) / peakMfeR) * 100)))
    : 0;
  const missedMfeR = Math.max(0, Math.round((peakMfeR - Math.max(0, exitR)) * 100) / 100);
  const missedMfePct = peakMfeR > 0 ? Math.round((missedMfeR / peakMfeR) * 100) : 0;

  const post = future.slice(exitBarIndex + 1);
  const postExitBars = post.length;
  let postExitContinuationR = 0;
  if (post.length) {
    const postMax = post.reduce((m, c) => Math.max(m, c.high), maxPrice);
    const postMin = post.reduce((m, c) => Math.min(m, c.low), minPrice);
    postExitContinuationR = mfeR(input.direction, input.entry, postMax, postMin, risk) - Math.max(0, exitR);
  }

  const postExitContinuationPct = postExitContinuationR >= 0.5;
  const secondLegCaptured = peakMfeR >= 2 && exitR < 2 && postExitContinuationR >= 0.5;

  const avgVol = averageVolume(future);
  const postVol = post.length ? averageVolume(post) : 0;
  const rvolSustainedAfterExit = postVol >= avgVol * 0.85 && post.length >= 2;

  const persistenceIntactAfterExit = input.planPersistence >= 55
    && postExitContinuationR >= 0.35;

  const vwap = input.vwap ?? input.entry;
  const vwapHealthyAfterExit = post.length
    ? post.every(c => input.direction === 'LONG' ? c.close >= vwap * 0.998 : c.close <= vwap * 1.002)
    : false;

  const falseExhaustion = input.planExhaustion >= 50
    && exitReason !== 'STOP'
    && missedMfeR >= 0.75
    && postExitContinuationPct;

  const exhaustionWhilePersistence = input.planExhaustion >= 48
    && input.planPersistence >= 52
    && (exitReason === 'TARGET' || earlyExit(exitR, peakMfeR))
    && postExitContinuationPct;

  const targetHit = exitReason === 'TARGET';
  const overTightTarget = targetHit && missedMfePct >= 40;
  const underExtendedTarget = !targetHit && peakMfeR >= 2;
  const earlyTrim = exitR < 0.5 && peakMfeR >= 1.2;
  const exitToPeakDistanceR = Math.max(0, peakMfeR - Math.max(0, exitR));

  const persistenceOverrideWouldHelp = holdOverride
    && missedMfeR >= 0.6
    && !targetHit;

  return {
    exitBarIndex,
    exitReason,
    exitR: Math.round(exitR * 100) / 100,
    peakMfeR: Math.round(peakMfeR * 100) / 100,
    retainedMfePct,
    missedMfeR,
    missedMfePct,
    postExitBars,
    postExitContinuationR: Math.round(postExitContinuationR * 100) / 100,
    postExitContinuationPct,
    secondLegCaptured,
    rvolSustainedAfterExit,
    persistenceIntactAfterExit,
    vwapHealthyAfterExit,
    falseExhaustion,
    exhaustionWhilePersistence,
    overTightTarget,
    underExtendedTarget,
    earlyTrim,
    exitToPeakDistanceR: Math.round(exitToPeakDistanceR * 100) / 100,
    targetHit,
    persistenceOverrideWouldHelp
  };
}

export function planExitFields(plan: ExecutionPlan): {
  persistence: number;
  exhaustion: number;
  exitLabel: string | null;
} {
  return {
    persistence: plan.continuationPersistence ?? 0,
    exhaustion: plan.exhaustionRisk ?? 0,
    exitLabel: plan.guidance?.exitLabel ?? null
  };
}

function mfeR(
  direction: 'LONG' | 'SHORT',
  entry: number,
  maxPrice: number,
  minPrice: number,
  risk: number
): number {
  const move = direction === 'LONG' ? maxPrice - entry : entry - minPrice;
  return move / risk;
}

function favorableAtClose(input: ExitPathInput, c: Candle): number {
  return input.direction === 'LONG' ? c.close - input.entry : input.entry - c.close;
}

function averageVolume(candles: Candle[]): number {
  if (!candles.length) return 0;
  return candles.reduce((s, c) => s + (c.volume ?? 0), 0) / candles.length;
}

function earlyExit(exitR: number, peakMfeR: number): boolean {
  return exitR < 1 && peakMfeR >= exitR + 0.8;
}
