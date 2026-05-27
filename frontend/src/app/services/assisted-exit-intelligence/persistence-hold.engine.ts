import { ExecutionFeedItem } from '../real-time-execution/real-time-execution.models';
import { PaperExecutionRecord } from '../../models/paper-execution.model';

export function scorePersistenceHold(
  record: PaperExecutionRecord,
  feed: ExecutionFeedItem | null
): number {
  let score = 45;
  const dom = record.dominanceScore ?? 50;
  const conv = record.convictionScore ?? 50;
  score += (dom - 50) * 0.25;
  score += (conv - 50) * 0.2;

  if (feed) {
    const persistMin = feed.persistenceSeconds / 60;
    score += Math.min(20, persistMin * 4);
    score += feed.triggerIntegrity * 12;
    if (/PERSISTENCE|INSTITUTIONAL/i.test(feed.opportunityType)) score += 10;
    if (feed.maturityState === 'EXHAUSTING') score -= 22;
    if (feed.convictionVelocity < -2) score -= 15;
  }

  if ((record.persistenceDurationSec ?? 0) > 90) score += 8;
  return clamp(score, 0, 100);
}

export function scorePersistenceSurvival(
  record: PaperExecutionRecord,
  feed: ExecutionFeedItem | null
): number {
  const hold = scorePersistenceHold(record, feed);
  const decay = feed ? Math.max(0, 100 - feed.convictionVelocity * 8) : 60;
  return clamp(hold * 0.7 + decay * 0.3, 0, 100);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
