import { Candle } from '../../models/candle.model';
import {
  DEFAULT_EVALUATION_WINDOW_MINUTES,
  EVALUATION_WINDOWS_MINUTES,
  EvaluationWindowResult,
  ExitReason,
  SignalDirection,
  SignalEvaluation,
  SignalOutcomeStatus
} from '../../models/signal-intelligence.model';

export interface EvaluationInput {
  direction: SignalDirection;
  entryPrice: number;
  stopPrice: number;
  targetPrice?: number;
  signalTimestamp: number;
  candles: Candle[];
  barDurationMinutes?: number;
  evaluationWindowMinutes?: number;
}

/** Deterministic signal path evaluation — no future leakage beyond supplied candles. */
export class SignalEvaluationEngine {

  evaluate(input: EvaluationInput): SignalEvaluation {
    const barMin = input.barDurationMinutes ?? this.inferBarDurationMinutes(input.candles);
    const windowMin = input.evaluationWindowMinutes ?? DEFAULT_EVALUATION_WINDOW_MINUTES;
    const startIdx = this.findStartIndex(input.candles, input.signalTimestamp);

    if (startIdx < 0) {
      return this.openEvaluation(windowMin);
    }

    const future = this.futureCandles(input.candles, startIdx, windowMin, barMin);
    if (future.length === 0) {
      return this.openEvaluation(windowMin);
    }

    const risk = Math.abs(input.entryPrice - input.stopPrice);
    if (risk <= 0) {
      return this.neutralEvaluation(future, input, barMin, windowMin, risk);
    }

    const path = this.walkPath(
      future,
      input.direction,
      input.entryPrice,
      input.stopPrice,
      input.targetPrice,
      risk
    );

    const windows = EVALUATION_WINDOWS_MINUTES.map(w =>
      this.evaluateWindow(input.candles, startIdx, input, w, barMin, risk)
    );

    const mfePercent = input.direction === 'LONG'
      ? (path.maxPrice - input.entryPrice) / input.entryPrice
      : (input.entryPrice - path.minPrice) / input.entryPrice;
    const maePercent = input.direction === 'LONG'
      ? (path.minPrice - input.entryPrice) / input.entryPrice
      : (input.entryPrice - path.maxPrice) / input.entryPrice;

    const mfeR = this.toR(input.direction, input.entryPrice, path.maxPrice, path.minPrice, risk, true);
    const maeR = this.toR(input.direction, input.entryPrice, path.maxPrice, path.minPrice, risk, false);

    let status: SignalOutcomeStatus = 'NEUTRAL';
    let exitReason: ExitReason | undefined = 'TIMEOUT';

    if (path.hit1RBeforeStop) {
      status = 'WIN';
      exitReason = path.targetHit ? 'TARGET' : undefined;
    } else if (path.stoppedOut) {
      status = 'LOSS';
      exitReason = 'STOP';
    }

    return {
      evaluated: true,
      status,
      mfe: mfeR,
      mae: maeR,
      mfePercent,
      maePercent,
      mfeR,
      maeR,
      hit1R: path.hit1R,
      hit2R: path.hit2R,
      stoppedOut: path.stoppedOut,
      targetHit: path.targetHit,
      barsHeld: future.length,
      durationMinutes: future.length * barMin,
      maxPriceSeen: path.maxPrice,
      minPriceSeen: path.minPrice,
      exitReason,
      evaluatedAt: Date.now(),
      evaluationWindowMinutes: windowMin,
      windows
    };
  }

  private evaluateWindow(
    candles: Candle[],
    startIdx: number,
    input: EvaluationInput,
    windowMinutes: number,
    barMin: number,
    risk: number
  ): EvaluationWindowResult {
    const future = this.futureCandles(candles, startIdx, windowMinutes, barMin);
    if (future.length === 0 || risk <= 0) {
      return {
        windowMinutes,
        mfeR: 0,
        maeR: 0,
        hit1R: false,
        hit2R: false,
        stoppedOut: false,
        status: 'OPEN'
      };
    }
    const path = this.walkPath(
      future,
      input.direction,
      input.entryPrice,
      input.stopPrice,
      input.targetPrice,
      risk
    );
    const mfeR = this.toR(input.direction, input.entryPrice, path.maxPrice, path.minPrice, risk, true);
    const maeR = this.toR(input.direction, input.entryPrice, path.maxPrice, path.minPrice, risk, false);
    let status: SignalOutcomeStatus = 'NEUTRAL';
    if (path.hit1RBeforeStop) status = 'WIN';
    else if (path.stoppedOut) status = 'LOSS';
    return {
      windowMinutes,
      mfeR,
      maeR,
      hit1R: path.hit1R,
      hit2R: path.hit2R,
      stoppedOut: path.stoppedOut,
      status
    };
  }

  private walkPath(
    candles: Candle[],
    direction: SignalDirection,
    entry: number,
    stop: number,
    target: number | undefined,
    risk: number
  ): {
    maxPrice: number;
    minPrice: number;
    hit1R: boolean;
    hit2R: boolean;
    hit1RBeforeStop: boolean;
    stoppedOut: boolean;
    targetHit: boolean;
  } {
    let maxPrice = entry;
    let minPrice = entry;
    let hit1R = false;
    let hit2R = false;
    let hit1RBeforeStop = false;
    let stoppedOut = false;
    let targetHit = false;
    let resolved = false;

    for (const c of candles) {
      maxPrice = Math.max(maxPrice, c.high);
      minPrice = Math.min(minPrice, c.low);

      const favorable = direction === 'LONG' ? c.high - entry : entry - c.low;
      const adverse = direction === 'LONG' ? entry - c.low : c.high - entry;

      if (!hit1R && favorable >= risk) hit1R = true;
      if (!hit2R && favorable >= risk * 2) hit2R = true;

      const stopHit = direction === 'LONG' ? c.low <= stop : c.high >= stop;
      const tgtHit = target != null
        && (direction === 'LONG' ? c.high >= target : c.low <= target);

      if (!resolved) {
        if (stopHit) {
          stoppedOut = true;
          resolved = true;
        } else if (hit1R) {
          hit1RBeforeStop = true;
          resolved = true;
        }
      }

      if (tgtHit) targetHit = true;

      // Track adverse excursion even after resolution for MFE/MAE bounds.
      void adverse;
    }

    if (!resolved && hit1R) hit1RBeforeStop = true;

    return { maxPrice, minPrice, hit1R, hit2R, hit1RBeforeStop, stoppedOut, targetHit };
  }

  private toR(
    direction: SignalDirection,
    entry: number,
    maxPrice: number,
    minPrice: number,
    risk: number,
    favorable: boolean
  ): number {
    if (risk <= 0) return 0;
    const move = favorable
      ? (direction === 'LONG' ? maxPrice - entry : entry - minPrice)
      : (direction === 'LONG' ? entry - minPrice : maxPrice - entry);
    return move / risk;
  }

  private findStartIndex(candles: Candle[], signalTs: number): number {
    if (!candles.length) return -1;
    const targetSec = Math.floor(signalTs / 1000);
    let best = -1;
    let bestDelta = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < candles.length; i++) {
      const sec = Math.floor(new Date(candles[i].time).getTime() / 1000);
      const delta = sec - targetSec;
      if (delta >= 0 && delta < bestDelta) {
        bestDelta = delta;
        best = i;
      }
    }
    if (best >= 0) return best;
    // Signal after last candle — cannot evaluate yet.
    const lastSec = Math.floor(new Date(candles[candles.length - 1].time).getTime() / 1000);
    return targetSec > lastSec ? -1 : candles.length - 1;
  }

  private futureCandles(
    candles: Candle[],
    startIdx: number,
    windowMinutes: number,
    barMin: number
  ): Candle[] {
    const maxBars = Math.max(1, Math.ceil(windowMinutes / Math.max(1, barMin)));
    return candles.slice(startIdx, startIdx + maxBars);
  }

  private inferBarDurationMinutes(candles: Candle[]): number {
    if (candles.length < 2) return 5;
    const a = new Date(candles[candles.length - 2].time).getTime();
    const b = new Date(candles[candles.length - 1].time).getTime();
    const diff = Math.abs(b - a) / 60_000;
    return diff > 0 ? diff : 5;
  }

  private openEvaluation(windowMin: number): SignalEvaluation {
    return {
      evaluated: false,
      status: 'OPEN',
      mfe: 0,
      mae: 0,
      mfePercent: 0,
      maePercent: 0,
      mfeR: 0,
      maeR: 0,
      hit1R: false,
      hit2R: false,
      stoppedOut: false,
      targetHit: false,
      barsHeld: 0,
      durationMinutes: 0,
      maxPriceSeen: 0,
      minPriceSeen: 0,
      evaluatedAt: Date.now(),
      evaluationWindowMinutes: windowMin
    };
  }

  private neutralEvaluation(
    future: Candle[],
    input: EvaluationInput,
    barMin: number,
    windowMin: number,
    risk: number
  ): SignalEvaluation {
    const maxPrice = Math.max(...future.map(c => c.high));
    const minPrice = Math.min(...future.map(c => c.low));
    const mfeR = risk > 0
      ? this.toR(input.direction, input.entryPrice, maxPrice, minPrice, risk, true)
      : 0;
    const maeR = risk > 0
      ? this.toR(input.direction, input.entryPrice, maxPrice, minPrice, risk, false)
      : 0;
    return {
      evaluated: true,
      status: 'NEUTRAL',
      mfe: mfeR,
      mae: maeR,
      mfePercent: input.direction === 'LONG'
        ? (maxPrice - input.entryPrice) / input.entryPrice
        : (input.entryPrice - minPrice) / input.entryPrice,
      maePercent: input.direction === 'LONG'
        ? (minPrice - input.entryPrice) / input.entryPrice
        : (input.entryPrice - maxPrice) / input.entryPrice,
      mfeR,
      maeR,
      hit1R: false,
      hit2R: false,
      stoppedOut: false,
      targetHit: false,
      barsHeld: future.length,
      durationMinutes: future.length * barMin,
      maxPriceSeen: maxPrice,
      minPriceSeen: minPrice,
      exitReason: 'TIMEOUT',
      evaluatedAt: Date.now(),
      evaluationWindowMinutes: windowMin
    };
  }
}
