import { ExecutionFeedItem } from '../real-time-execution/real-time-execution.models';
import { PaperExecutionRecord } from '../../models/paper-execution.model';

/** Continuation survival score — monetization validation focus. */
export function scoreContinuationSurvival(
  record: PaperExecutionRecord,
  feed: ExecutionFeedItem | null
): number {
  const mfe = record.mfeR ?? 0;
  const mae = record.maeR ?? 0;
  let score = 50;

  if (mfe > 0.003) score += 18;
  if (mfe > 0.008) score += 12;
  if (mae > -0.004) score += 8;
  if (record.continuationSurvival) score += 10;

  if (feed) {
    if (feed.maturityState === 'CONFIRMED' || feed.maturityState === 'EXTENDED') score += 12;
    if (feed.convictionVelocity > 0) score += 6;
    if (feed.persistenceSeconds > 120) score += Math.min(12, feed.persistenceSeconds / 60);
    if (feed.maturityState === 'EXHAUSTING') score -= 18;
    if (feed.maturityState === 'FAILED') score -= 35;
    score += feed.expansionProbability * 15;
  }

  return clamp(score, 0, 100);
}

export function scoreContinuationHealth(
  record: PaperExecutionRecord,
  feed: ExecutionFeedItem | null
): number {
  const survival = scoreContinuationSurvival(record, feed);
  const mfeCapture = record.mfeR != null && record.fillPrice
    ? Math.min(100, Math.max(0, (record.mfeR + 0.02) * 400))
    : 40;
  return clamp(survival * 0.65 + mfeCapture * 0.35, 0, 100);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
