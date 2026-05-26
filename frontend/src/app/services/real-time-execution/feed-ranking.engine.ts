import { ExecutionFeedItem } from './real-time-execution.models';

/** Rank feed items — velocity-aware conviction ranking. */
export function compareFeedItems(a: ExecutionFeedItem, b: ExecutionFeedItem): number {
  const rankA = a.conviction + Math.max(0, a.convictionVelocity) * 1.5;
  const rankB = b.conviction + Math.max(0, b.convictionVelocity) * 1.5;
  if (rankB !== rankA) return rankB - rankA;
  if (b.expansionProbability !== a.expansionProbability) return b.expansionProbability - a.expansionProbability;
  return b.triggerIntegrity - a.triggerIntegrity;
}

export function feedRankScore(item: ExecutionFeedItem): number {
  return item.conviction + Math.max(0, item.convictionVelocity) * 1.5;
}

export function isRisingVelocity(item: ExecutionFeedItem): boolean {
  return item.convictionVelocity >= 8;
}

export function maturityLabel(state: string): string {
  return state.replace(/_/g, ' ');
}
