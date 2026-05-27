import { ExecutionFeedItem } from '../real-time-execution/real-time-execution.models';
import { PaperExecutionRecord } from '../../models/paper-execution.model';

export function scoreSecondLegProbability(
  record: PaperExecutionRecord,
  feed: ExecutionFeedItem | null
): number {
  let p = 28;
  const mfe = record.mfeR ?? 0;
  if (mfe > 0.005) p += 15;
  if (mfe > 0.012) p += 12;
  if (record.secondLegCaptured) p += 25;

  if (feed) {
    if (/EXPANSION|COMPRESSION|EXTENSION/i.test(feed.opportunityType)) p += 14;
    if (feed.maturityState === 'EXTENDED') p += 18;
    if (feed.convictionVelocity > 1) p += 10;
    if (feed.expansionProbability > 0.55) p += 12;
    if (feed.maturityState === 'EXHAUSTING' || feed.maturityState === 'FAILED') p -= 25;
  }
  return clamp(p, 0, 100);
}

export function detectSecondLegActive(
  record: PaperExecutionRecord,
  feed: ExecutionFeedItem | null
): boolean {
  const prob = scoreSecondLegProbability(record, feed);
  const mfe = record.mfeR ?? 0;
  return prob >= 62 && mfe > 0.004 && (feed?.maturityState === 'EXTENDED' || feed?.maturityState === 'CONFIRMED');
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
