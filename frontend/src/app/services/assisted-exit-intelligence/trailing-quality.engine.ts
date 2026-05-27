import { PaperExecutionRecord } from '../../models/paper-execution.model';

/** How well continuation is being monetized via trailing hold (MFE retention proxy). */
export function scoreTrailingQuality(record: PaperExecutionRecord): number {
  const mfe = record.mfeR ?? 0;
  const mae = record.maeR ?? 0;
  if (mfe <= 0) return 25;
  const drawdownFromPeak = mfe - Math.max(mae, 0);
  const retention = mfe > 0 ? Math.max(0, 1 - Math.abs(drawdownFromPeak) / (mfe + 0.001)) : 0;
  let score = 40 + retention * 45;
  if (record.realizedR != null && record.mfeR != null && record.mfeR > 0) {
    const captured = record.realizedR / record.mfeR;
    score = clamp(35 + captured * 55, 0, 100);
  }
  return clamp(score, 0, 100);
}

export function scorePostEntryMfeCapture(record: PaperExecutionRecord): number {
  const mfe = record.mfeR ?? 0;
  if (mfe <= 0) return 15;
  return clamp(30 + mfe * 800, 0, 100);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
