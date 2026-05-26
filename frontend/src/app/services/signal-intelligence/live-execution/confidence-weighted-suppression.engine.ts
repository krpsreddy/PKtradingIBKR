import { ConditionCluster, EdgeDecaySignal } from '../edge-discovery/edge-discovery.models';
import {
  ConfidenceWeightedSuppression,
  ConfidenceWeightedState,
  ContinuationQualitySnapshot,
  LiveExecutionContext,
  StatisticalConfidenceBand
} from './live-execution.models';
import { breadthFromContext, normalizeRegime, normalizeSetup } from './live-execution-context.util';

/** Statistical safety — hard governance floors (Phase 138). */
export const MIN_SUPPRESS_SAMPLES = 10;
export const MIN_TOXIC_SAMPLES = 40;
export const MIN_TOXIC_EXPECTANCY = -0.75;

export interface ConfidenceWeightedInput {
  ctx: LiveExecutionContext;
  cluster: ConditionCluster | null;
  continuation: ContinuationQualitySnapshot;
  fakeoutRate: number;
  regimeStable: boolean;
  decaySignals: EdgeDecaySignal[];
  breadthAligned: boolean;
  timeStability: number;
}

/** Confidence-weighted suppression — advisory capital governance. */
export class ConfidenceWeightedSuppressionEngine {

  evaluate(input: ConfidenceWeightedInput): ConfidenceWeightedSuppression {
    const m = input.cluster?.metrics;
    const n = m?.sampleCount ?? 0;
    const expectancy = m?.expectancyR ?? 0;
    const winRate = m?.winRate ?? 50;
    const fakeout = input.fakeoutRate || m?.fakeoutRate || 0;

    const statisticalConfidence = this.statisticalConfidence(n, winRate, fakeout);
    const edgeStability = this.edgeStability(input, n, expectancy);
    const confidence = confidenceBand(statisticalConfidence);
    const reasoning: string[] = [];

    let state: ConfidenceWeightedState = 'ALLOW';
    let sizeMultiplier = 1;

    if (n < MIN_SUPPRESS_SAMPLES) {
      reasoning.push(`Insufficient samples (n=${n}) — advisory only, no hard suppression`);
      if (expectancy < 0) {
        state = 'SELECTIVE';
        sizeMultiplier = 0.9;
        reasoning.push(`Marginal negative expectancy (${expectancy.toFixed(2)}R) — proceed selectively`);
      } else {
        state = 'ALLOW';
        sizeMultiplier = confidence === 'LOW' ? 0.85 : 0.95;
      }
      return this.result(state, confidence, sizeMultiplier, reasoning, statisticalConfidence, edgeStability);
    }

    const decayHit = input.decaySignals.some(d => d.decayPct >= 25);
    if (decayHit) reasoning.push('Edge decay detected in matched cluster window');

    if (n >= MIN_TOXIC_SAMPLES && expectancy <= MIN_TOXIC_EXPECTANCY && confidence === 'VERY_HIGH') {
      state = 'TOXIC';
      sizeMultiplier = 0;
      reasoning.push(`Persistent toxic expectancy (${expectancy.toFixed(2)}R, n=${n})`);
      return this.result(state, confidence, sizeMultiplier, reasoning, statisticalConfidence, edgeStability);
    }

    if (expectancy > 0.08 && fakeout < 40 && input.breadthAligned) {
      state = confidence === 'LOW' ? 'SELECTIVE' : 'ALLOW';
      sizeMultiplier = confidence === 'VERY_HIGH' ? 1 : confidence === 'HIGH' ? 0.95 : 0.85;
      reasoning.push(`Positive expectancy (+${expectancy.toFixed(2)}R) with aligned conditions`);
    } else if (expectancy > 0) {
      state = 'SELECTIVE';
      sizeMultiplier = 0.85;
      reasoning.push(`Marginal positive expectancy (+${expectancy.toFixed(2)}R)`);
    } else if (expectancy > -0.3) {
      state = 'SELECTIVE';
      sizeMultiplier = 0.8;
      reasoning.push(`Mild negative expectancy (${expectancy.toFixed(2)}R, n=${n})`);
    } else if (expectancy > -0.75) {
      state = 'REDUCE_SIZE';
      sizeMultiplier = confidence === 'HIGH' || confidence === 'VERY_HIGH' ? 0.5 : 0.65;
      reasoning.push(`Material negative expectancy (${expectancy.toFixed(2)}R, n=${n})`);
    } else if (n >= MIN_TOXIC_SAMPLES) {
      state = confidence === 'VERY_HIGH' ? 'TOXIC' : 'SUPPRESS';
      sizeMultiplier = state === 'TOXIC' ? 0 : 0.35;
      reasoning.push(`Deep negative expectancy (${expectancy.toFixed(2)}R, n=${n})`);
    } else {
      state = 'REDUCE_SIZE';
      sizeMultiplier = 0.5;
      reasoning.push(`Negative expectancy (${expectancy.toFixed(2)}R) — reduced size until n≥${MIN_TOXIC_SAMPLES}`);
    }

    if (confidence === 'HIGH' && expectancy < 0 && state !== 'TOXIC') {
      if (state === 'SELECTIVE') state = 'REDUCE_SIZE';
      else if (state === 'REDUCE_SIZE' && n >= MIN_SUPPRESS_SAMPLES) state = 'SUPPRESS';
      sizeMultiplier = Math.min(sizeMultiplier, 0.5);
      reasoning.push('High statistical confidence on negative edge — stronger suppression');
    }

    if (fakeout >= 45 && expectancy <= 0) {
      sizeMultiplier = Math.min(sizeMultiplier, 0.6);
      if (state === 'ALLOW') state = 'SELECTIVE';
      reasoning.push(`Elevated fakeout rate (${fakeout}%)`);
    }

    if (input.continuation.level === 'FAILING' || input.continuation.level === 'WEAK') {
      sizeMultiplier = Math.min(sizeMultiplier, 0.7);
      if (state === 'ALLOW') state = 'SELECTIVE';
      reasoning.push(`Continuation quality ${input.continuation.level.toLowerCase()}`);
    }

    if (!input.regimeStable) {
      sizeMultiplier = Math.min(sizeMultiplier, 0.75);
      reasoning.push('Regime instability in setup×regime matrix');
    }

    const setup = normalizeSetup(input.ctx.signalType);
    const regime = normalizeRegime(input.ctx.marketRegime);
    if (setup === 'INSTITUTIONAL_ACCELERATION' && regime === 'CHOP' && expectancy <= 0) {
      state = n >= MIN_SUPPRESS_SAMPLES ? 'SUPPRESS' : 'REDUCE_SIZE';
      sizeMultiplier = Math.min(sizeMultiplier, 0.4);
      reasoning.push('Breakout in chop — confidence-weighted suppress');
    }

    return this.result(state, confidence, sizeMultiplier, reasoning, statisticalConfidence, edgeStability);
  }

  private statisticalConfidence(n: number, winRate: number, fakeout: number): number {
    const sampleScore = Math.min(50, (Math.min(n, 200) / 200) * 50);
    const wrScore = Math.min(25, Math.abs(winRate - 50) * 0.5);
    const fakeoutScore = Math.min(25, fakeout * 0.25);
    return Math.round(Math.min(100, sampleScore + wrScore + fakeoutScore));
  }

  private edgeStability(input: ConfidenceWeightedInput, n: number, expectancy: number): number {
    let score = 50;
    if (input.regimeStable) score += 15;
    if (input.breadthAligned) score += 10;
    if (input.timeStability >= 60) score += 10;
    if (input.decaySignals.length === 0) score += 10;
    else score -= input.decaySignals[0].decayPct * 0.3;
    if (n >= 40) score += 10;
    if (Math.abs(expectancy) > 0.5) score += 5;
    if (input.continuation.level === 'VERY_STRONG' || input.continuation.level === 'STRONG') score += 10;
    return Math.round(Math.min(100, Math.max(0, score)));
  }

  private result(
    state: ConfidenceWeightedState,
    confidence: StatisticalConfidenceBand,
    sizeMultiplier: number,
    reasoning: string[],
    statisticalConfidence: number,
    edgeStability: number
  ): ConfidenceWeightedSuppression {
    return {
      state,
      confidence,
      sizeMultiplier: Math.round(sizeMultiplier * 100) / 100,
      reasoning,
      statisticalConfidence,
      edgeStability,
      advisoryOnly: true
    };
  }
}

function confidenceBand(score: number): StatisticalConfidenceBand {
  if (score >= 80) return 'VERY_HIGH';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

export function governanceLabel(state: ConfidenceWeightedState): string {
  switch (state) {
    case 'ALLOW': return 'FULL EDGE';
    case 'SELECTIVE': return 'SELECTIVE';
    case 'REDUCE_SIZE': return 'REDUCE SIZE';
    case 'SUPPRESS': return 'SUPPRESS';
    case 'TOXIC': return 'TOXIC ENVIRONMENT';
  }
}

export function mapGovernanceToGateState(state: ConfidenceWeightedState): import('./live-execution.models').LiveExecutionGateState {
  switch (state) {
    case 'ALLOW': return 'EDGE_ACTIVE';
    case 'SELECTIVE': return 'SELECTIVE';
    case 'REDUCE_SIZE': return 'REDUCE_SIZE';
    case 'SUPPRESS': return 'NO_EDGE';
    case 'TOXIC': return 'TOXIC';
  }
}
