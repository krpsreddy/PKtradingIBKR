import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { EntryTimingQuality } from '../live-execution/live-execution.models';
import { avg, computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { EvaluationWindowResult } from '../../../models/signal-intelligence.model';

export function windowAt(ev: SignalSnapshot['evaluation'], minutes: number): EvaluationWindowResult | undefined {
  return ev?.windows?.find(w => w.windowMinutes === minutes);
}

export function realizedR(s: SignalSnapshot): number {
  const ev = s.evaluation;
  if (!ev?.evaluated) return 0;
  if (ev.status === 'WIN') return ev.hit2R ? 2 : ev.hit1R ? 1 : Math.min(ev.mfeR, 1);
  if (ev.status === 'LOSS') return ev.maeR;
  return ev.mfeR * 0.35;
}

export function resolveEntryTiming(s: SignalSnapshot): EntryTimingQuality {
  if (s.extendedEntry) return 'CHASE';
  const mins = s.sessionTimeMinutes ?? 0;
  if (s.captureStage === 'ENTERED' && mins > 45) return 'LATE';
  if (mins > 30) return 'LATE';
  if (mins <= 5 && s.captureStage === 'TRIGGERED') return 'EARLY';
  return 'IDEAL';
}

export function playbookKey(s: SignalSnapshot): string {
  return `${s.signalType}·${s.marketRegime}`;
}

export function playbookLabel(key: string): string {
  return key.replace('·', ' × ');
}

export function aggregateExpectancyByTiming(signals: SignalSnapshot[]): { timing: EntryTimingQuality; n: number; expectancyR: number }[] {
  const timings: EntryTimingQuality[] = ['EARLY', 'IDEAL', 'LATE', 'CHASE'];
  return timings.map(timing => {
    const bucket = evaluatedSignals(signals).filter(s => resolveEntryTiming(s) === timing);
    return { timing, n: bucket.length, expectancyR: bucket.length ? computeExpectancyR(bucket) : 0 };
  }).filter(r => r.n > 0);
}

export function healthScore(h: string): number {
  switch (h) {
    case 'VERY_STRONG': return 95;
    case 'STRONG': return 78;
    case 'MODERATE': return 58;
    case 'WEAKENING': return 38;
    case 'FAILING': return 15;
    default: return 50;
  }
}

export function avgHealth(paths: { continuationHealth: string }[]): number {
  if (!paths.length) return 0;
  return Math.round(paths.reduce((a, p) => a + healthScore(p.continuationHealth), 0) / paths.length);
}

export function confidenceFromSamples(n: number): number {
  if (n >= 40) return 92;
  if (n >= 20) return 78;
  if (n >= 10) return 62;
  if (n >= 5) return 45;
  return 28;
}
