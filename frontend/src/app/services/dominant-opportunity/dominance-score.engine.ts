import { DominanceContext } from './dominant-opportunity.models';
import { continuationDominanceScore } from './continuation-dominance.engine';
import { institutionalPressureScore } from './institutional-pressure.engine';
import { executionPriorityScore } from './execution-priority.engine';
import { marketModeWeights } from './market-attention.engine';

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * Dominance ≠ highest conviction alone.
 * Velocity + persistence + institutional flow can outrank static high conviction.
 */
export function computeDominanceScore(ctx: DominanceContext): number {
  const { card, nano, marketMode, convictionDelta, degrading, exhausting, marketLeaderBoost } = ctx;
  const w = marketModeWeights(marketMode);

  if (degrading || exhausting || card.action === 'AVOID') {
    return clamp(Math.round(12 + (card.convictionScore ?? 0) * 0.08));
  }

  const conviction = card.convictionScore ?? 0;
  const velocity =
    (nano?.convictionVelocity ?? 0) * 0.35 +
    (nano?.popVelocity ?? card.popVelocity ?? 0) * 0.45 +
    Math.max(0, convictionDelta) * 1.1;
  const persistence = continuationDominanceScore(card, nano);
  const institutional = institutionalPressureScore(card);
  const execution = executionPriorityScore(card);
  const rvolSustain = rvolSustainmentScore(card);
  const trigger = card.triggerIntegrity ?? 0;
  const expansion = (card.expansionProbability ?? 0) * 0.35;
  const exhaustionInv = 100 - (card.exhaustionProbability ?? 0);
  const narrative = Math.min(12, (card.whyNow?.length ?? 0) * 4);
  const leadership = marketLeaderBoost;

  const staticPenalty = conviction >= 72 && velocity < 12 && persistence < 50 ? -14 : 0;
  const risingBonus = card.isRising ? 6 : 0;

  const raw =
    conviction * 0.22 +
    velocity * w.velocity * 0.28 +
    persistence * w.persistence * 0.2 +
    institutional * w.institutional * 0.14 +
    execution * w.execution * 0.1 +
    rvolSustain * 0.08 +
    trigger * 0.06 +
    expansion * 0.05 +
    exhaustionInv * 0.06 +
    narrative +
    leadership +
    risingBonus +
    staticPenalty;

  return clamp(Math.round(raw));
}

export function computeAttentionPriorityScore(
  dominanceScore: number,
  convictionDelta: number,
  suppressWeight: number
): number {
  const emergingBoost = convictionDelta >= 12 ? 8 : convictionDelta >= 6 ? 4 : 0;
  return clamp(Math.round(dominanceScore + emergingBoost - suppressWeight * 35));
}

function rvolSustainmentScore(card: import('../autonomous-regime-scanner/autonomous-regime-scanner.models').ScannerOpportunityCard): number {
  const label = (card.rvolLabel ?? '').toLowerCase();
  if (label.includes('elite') || label.includes('extreme')) return 88;
  if (label.includes('high') || label.includes('elevated')) return 72;
  if (label.includes('above')) return 55;
  return 35;
}

/** Relative market leadership among peers (0–18 boost). */
export function marketLeadershipBoost(
  symbol: string,
  dominanceBySymbol: Map<string, number>
): number {
  const scores = [...dominanceBySymbol.entries()].sort((a, b) => b[1] - a[1]);
  if (!scores.length) return 0;
  const rank = scores.findIndex(([s]) => s === symbol);
  if (rank === 0) return 18;
  if (rank === 1) return 10;
  if (rank === 2) return 5;
  return 0;
}
