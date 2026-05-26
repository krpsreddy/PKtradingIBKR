import { SignalEvaluation } from '../../models/signal-intelligence.model';
import { PlanOutcomeSample, ModeAggregateMetrics, ValidationPlanMode } from './execution-template-validation.models';

export function realizedR(evalResult: SignalEvaluation): number {
  if (!evalResult.evaluated) return 0;
  if (evalResult.status === 'WIN') return evalResult.mfeR ?? 1;
  if (evalResult.status === 'LOSS') return evalResult.maeR ?? -1;
  return evalResult.mfeR ?? 0;
}

export function win(evalResult: SignalEvaluation): boolean {
  return evalResult.status === 'WIN' || (evalResult.mfeR ?? 0) >= 0.5;
}

export function mfeCapturePct(evalResult: SignalEvaluation, plannedRr: number | null): number {
  const mfe = evalResult.mfeR ?? 0;
  if (plannedRr != null && plannedRr > 0) {
    return Math.round(Math.min(100, (mfe / plannedRr) * 100));
  }
  return Math.round(Math.min(100, mfe * 50));
}

export function maeEfficiency(evalResult: SignalEvaluation): number {
  const mae = Math.abs(evalResult.maeR ?? 0);
  return Math.round(Math.max(0, 100 - mae * 35));
}

export function stopEfficiency(evalResult: SignalEvaluation): number {
  if (!evalResult.evaluated) return 0;
  if (evalResult.stoppedOut && evalResult.status === 'LOSS') return 100;
  if (evalResult.stoppedOut && (evalResult.mfeR ?? 0) >= 1) return 20;
  return evalResult.stoppedOut ? 50 : 85;
}

export function targetEfficiency(evalResult: SignalEvaluation): number {
  return evalResult.targetHit ? 100 : (evalResult.mfeR ?? 0) >= 1 ? 55 : 15;
}

export function aggregateModeMetrics(
  mode: ValidationPlanMode,
  samples: PlanOutcomeSample[]
): ModeAggregateMetrics {
  const rows = samples.filter(s => s.mode === mode);
  const n = rows.length;
  if (!n) {
    return emptyMetrics(mode);
  }

  const cont = rows.filter(s => s.signalType.includes('CONT') || s.signalType.includes('MOM'));
  const exhaust = rows.filter(s => s.regime === 'EXHAUSTION_DRIFT');
  const shallow = rows.filter(s => s.regime === 'SHALLOW_PULLBACK_CONTINUATION');
  const early = rows.filter(s => s.regime === 'EARLY_EXPANSION');
  const vwap = rows.filter(s => s.regime === 'VWAP_ACCEPTANCE');
  const compress = rows.filter(s => s.regime === 'COMPRESSION_BREAKOUT');
  const lateExt = rows.filter(s => s.regime === 'HEALTHY_EXTENSION' || s.extended);
  const withAdd = rows.filter(s => s.addHit);

  const avg = (fn: (s: PlanOutcomeSample) => number) =>
    Math.round(rows.reduce((sum, s) => sum + fn(s), 0) / n * 100) / 100;

  const pct = (subset: PlanOutcomeSample[], pred: (s: PlanOutcomeSample) => boolean) =>
    subset.length ? Math.round(subset.filter(pred).length / subset.length * 1000) / 10 : 0;

  return {
    mode,
    sampleCount: n,
    expectancy: avg(s => realizedR(s.evaluation)),
    winRate: pct(rows, s => win(s.evaluation)),
    averageR: avg(s => s.evaluation.mfeR ?? 0),
    mfeCapturePct: avg(s => s.mfeCapturePct),
    maeEfficiency: avg(s => maeEfficiency(s.evaluation)),
    stopEfficiency: avg(s => stopEfficiency(s.evaluation)),
    targetEfficiency: avg(s => targetEfficiency(s.evaluation)),
    continuationCapture: pct(cont, s => (s.evaluation.mfeR ?? 0) >= 1),
    exhaustionAvoidance: pct(exhaust, s => !s.evaluation.stoppedOut || (s.evaluation.maeR ?? 0) > -0.5),
    shallowPbEfficiency: pct(shallow, s => win(s.evaluation)),
    addEfficiency: pct(withAdd, s => (s.evaluation.mfeR ?? 0) >= 0.5),
    earlyExpansionCapture: pct(early, s => (s.evaluation.mfeR ?? 0) >= 1.2),
    vwapContinuationSuccess: pct(vwap, s => win(s.evaluation)),
    compressionBreakoutSuccess: pct(compress, s => (s.evaluation.mfeR ?? 0) >= 1),
    lateExtensionFailureRate: pct(lateExt, s => s.evaluation.stoppedOut && s.evaluation.status === 'LOSS')
  };
}

function emptyMetrics(mode: ValidationPlanMode): ModeAggregateMetrics {
  return {
    mode,
    sampleCount: 0,
    expectancy: 0,
    winRate: 0,
    averageR: 0,
    mfeCapturePct: 0,
    maeEfficiency: 0,
    stopEfficiency: 0,
    targetEfficiency: 0,
    continuationCapture: 0,
    exhaustionAvoidance: 0,
    shallowPbEfficiency: 0,
    addEfficiency: 0,
    earlyExpansionCapture: 0,
    vwapContinuationSuccess: 0,
    compressionBreakoutSuccess: 0,
    lateExtensionFailureRate: 0
  };
}

export function confidenceLevel(input: {
  eventCount: number;
  symbolCount: number;
  regimeCount: number;
  marketTagCount: number;
  expectancyDelta: number;
}): import('./execution-template-validation.models').ValidationConfidence {
  const { eventCount, symbolCount, regimeCount, marketTagCount, expectancyDelta } = input;
  if (eventCount < 80 || symbolCount < 2) return 'LOW';
  if (eventCount < 500 || symbolCount < 5 || regimeCount < 4) {
    return Math.abs(expectancyDelta) >= 0.1 ? 'MEDIUM' : 'LOW';
  }
  if (symbolCount >= 8 && regimeCount >= 5 && marketTagCount >= 4 && Math.abs(expectancyDelta) >= 0.06) {
    return 'HIGH';
  }
  return Math.abs(expectancyDelta) >= 0.08 ? 'MEDIUM' : 'LOW';
}
