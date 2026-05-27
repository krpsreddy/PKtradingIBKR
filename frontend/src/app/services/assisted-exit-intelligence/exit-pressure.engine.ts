import { ExecutionFeedItem } from '../real-time-execution/real-time-execution.models';
import { PaperExecutionRecord } from '../../models/paper-execution.model';

/** Higher = more pressure to exit (advisory only). */
export function scoreExitPressure(
  record: PaperExecutionRecord,
  feed: ExecutionFeedItem | null
): number {
  let pressure = 12;
  const mae = record.maeR ?? 0;
  if (mae < -0.006) pressure += 22;
  if (mae < -0.012) pressure += 18;

  if (feed) {
    if (feed.maturityState === 'EXHAUSTING') pressure += 28;
    if (feed.maturityState === 'FAILED') pressure += 40;
    if (feed.tone === 'RED' || feed.tone === 'ORANGE') pressure += 15;
    if (feed.convictionVelocity < -3) pressure += 20;
    if (/EXHAUSTION|FAILED|DEGRAD/i.test(feed.opportunityType)) pressure += 25;
    if (/VWAP/i.test(feed.opportunityType) && feed.triggerIntegrity < 0.45) pressure += 18;
    pressure += (1 - feed.expansionProbability) * 20;
  }

  const mfe = record.mfeR ?? 0;
  if (mfe > 0.01 && feed?.maturityState === 'EXHAUSTING') pressure += 12;

  return clamp(pressure, 0, 100);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
