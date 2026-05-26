import { AttentionPriority, ContextEmphasis, SetupCandidate } from '../models/execution.model';
import { MarketTrend } from '../models/workspace.model';
import { computeAttentionScore } from './attention-score.util';
import { computeSignalHealth } from './signal-health.util';
import { getContextEmphasis } from './context-emphasis.util';

export interface AttentionResult {
  score: number;
  priority: AttentionPriority;
  emphasis: ContextEmphasis;
}

export function computeAttentionPriority(
  source: SetupCandidate,
  marketTrend: MarketTrend | null,
  rankIndex = 0
): AttentionResult {
  let score = computeAttentionScore(source);
  const emphasis = getContextEmphasis(source.signalType, marketTrend);

  if (emphasis.deemphasize) {
    score = Math.round(score * emphasis.glowMultiplier);
  } else {
    score = Math.min(100, score + emphasis.rankBoost);
  }

  if (rankIndex === 0) score = Math.min(100, score + 8);
  if (source.freshness === 'FRESH') score = Math.min(100, score + 5);

  const health = computeSignalHealth(source);
  if (health.state === 'WEAKENING') score -= 8;
  if (health.state === 'FAILING') score -= 15;

  score = Math.max(0, Math.min(100, score));

  let priority: AttentionPriority;
  if (score >= 82 && source.freshness === 'FRESH') priority = 'CRITICAL';
  else if (score >= 65) priority = 'HIGH';
  else if (score >= 40) priority = 'MEDIUM';
  else priority = 'LOW';

  if (emphasis.deemphasize && priority === 'CRITICAL') priority = 'HIGH';
  if (emphasis.deemphasize && priority === 'HIGH') priority = 'MEDIUM';

  return { score, priority, emphasis };
}

export function priorityClass(priority: AttentionPriority): string {
  return `priority-${priority.toLowerCase()}`;
}

export function priorityPulse(priority: AttentionPriority, freshness?: string | null): boolean {
  return priority === 'CRITICAL' || (priority === 'HIGH' && freshness === 'FRESH');
}
