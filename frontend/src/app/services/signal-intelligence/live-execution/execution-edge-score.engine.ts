import { ConditionCluster } from '../edge-discovery/edge-discovery.models';
import {
  ContinuationQualitySnapshot,
  LiveExecutionContext,
  LiveFakeoutRiskLevel,
  OpenTypeSnapshot,
  PremarketExtensionSnapshot,
  SuppressionRule
} from './live-execution.models';
import {
  breadthFromContext,
  extensionPctFromContext,
  normalizeRegime,
  normalizeSetup,
  rvolFromContext,
  timeFromContext
} from './live-execution-context.util';
import { openTypeStrength } from './open-type-classification.engine';

/** 0–100 execution quality score from live conditions. */
export class ExecutionEdgeScoreEngine {

  score(input: {
    ctx: LiveExecutionContext;
    cluster: ConditionCluster | null;
    continuation: ContinuationQualitySnapshot;
    fakeoutLevel: LiveFakeoutRiskLevel;
    openType: OpenTypeSnapshot;
    premarket: PremarketExtensionSnapshot;
    suppressions: SuppressionRule[];
    discoveryEdgeScore: number;
  }): number {
    let score = input.discoveryEdgeScore || 50;

    const cluster = input.cluster;
    if (cluster) {
      score = cluster.edgeScore * 0.55 + score * 0.45;
      if (cluster.metrics.expectancyR > 0) score += cluster.metrics.expectancyR * 12;
      if (cluster.metrics.fakeoutRate > 40) score -= (cluster.metrics.fakeoutRate - 40) * 0.4;
    }

    switch (input.continuation.level) {
      case 'VERY_STRONG': score += 12; break;
      case 'STRONG': score += 8; break;
      case 'MODERATE': score += 2; break;
      case 'WEAK': score -= 8; break;
      case 'FAILING': score -= 18; break;
    }

    switch (input.fakeoutLevel) {
      case 'LOW': score += 6; break;
      case 'MODERATE': score -= 4; break;
      case 'HIGH': score -= 14; break;
      case 'EXTREME': score -= 24; break;
    }

    const otStrength = openTypeStrength(input.openType.openType);
    if (otStrength === 'STRONG') score += 8;
    if (otStrength === 'WEAK') score -= 12;

    if (breadthFromContext(input.ctx) === 'STRONG') score += 6;
    if (breadthFromContext(input.ctx) === 'WEAK') score -= 10;

    const regime = normalizeRegime(input.ctx.marketRegime);
    const setup = normalizeSetup(input.ctx.signalType);
    if (setup === 'INSTITUTIONAL_ACCELERATION' && regime === 'CHOP') score -= 15;
    if (setup === 'VWAP_PERSISTENCE' && input.openType.reclaimEnvironment) score += 8;

    const ext = extensionPctFromContext(input.ctx);
    if (ext >= 8 && setup === 'EARLY_CONTINUATION') score -= 12;
    if (input.ctx.entryQuality === 'LATE' || input.ctx.entryQuality === 'CHASE') score -= 10;

    const rvol = rvolFromContext(input.ctx);
    if (rvol === '>5' && regime === 'CHOP') score -= 8;

    for (const s of input.suppressions) {
      if (s.severity === 'SUPPRESS') score -= 18;
      else if (s.severity === 'REDUCE') score -= 8;
      else score -= 4;
    }

    if (input.premarket.fakeoutProbability >= 40) score -= 6;

    return Math.round(Math.min(100, Math.max(0, score)));
  }
}

export function sizeMultiplierFromScore(score: number, state: string): number {
  if (state === 'TOXIC' || state === 'NO_EDGE') return 0;
  if (state === 'REDUCE_SIZE') return 0.5;
  if (state === 'SELECTIVE') return 0.75;
  if (score >= 80) return 1;
  if (score >= 65) return 0.85;
  if (score >= 50) return 0.7;
  return 0.5;
}
