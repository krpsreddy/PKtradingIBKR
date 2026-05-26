import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, pct } from '../signal-intelligence.math';

export const MIN_ROBUST_SAMPLE = 10;
export const MIN_LOW_CONFIDENCE = 25;

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function mfeR(s: SignalSnapshot): number {
  return s.evaluation?.mfeR ?? 0;
}

export function sessionDateFromTs(ts: number): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function avgR(signals: SignalSnapshot[]): number {
  if (!signals.length) return 0;
  return round2(signals.reduce((n, s) => n + mfeR(s), 0) / signals.length);
}

export function winRate(signals: SignalSnapshot[]): number {
  if (!signals.length) return 0;
  const wins = signals.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5);
  return pct(wins.length, signals.length);
}

export function expectancyR(signals: SignalSnapshot[]): number {
  return round2(computeExpectancyR(signals));
}

export function symbolConcentration(signals: SignalSnapshot[]): number {
  if (!signals.length) return 100;
  const counts = new Map<string, number>();
  for (const s of signals) counts.set(s.symbol, (counts.get(s.symbol) ?? 0) + 1);
  const top = Math.max(...counts.values());
  return round2((top / signals.length) * 100);
}

export function topSymbols(signals: SignalSnapshot[], n = 5): string[] {
  const counts = new Map<string, number>();
  for (const s of signals) counts.set(s.symbol, (counts.get(s.symbol) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([sym]) => sym);
}

export function trimTopOutliers(signals: SignalSnapshot[], n = 3): SignalSnapshot[] {
  return signals.slice().sort((a, b) => mfeR(b) - mfeR(a)).slice(n);
}

export function splitWalkforward(signals: SignalSnapshot[]): { train: SignalSnapshot[]; test: SignalSnapshot[] } {
  const sorted = signals.slice().sort((a, b) => a.timestamp - b.timestamp);
  const mid = Math.floor(sorted.length / 2);
  return { train: sorted.slice(0, mid), test: sorted.slice(mid) };
}

export function breadthBucket(trendAlignment: number | undefined): string {
  const t = trendAlignment ?? 50;
  if (t >= 70) return 'STRONG';
  if (t >= 50) return 'MID';
  return 'WEAK';
}

export function volatilityBucket(volatility: number | undefined): string {
  const v = volatility ?? 0;
  if (v >= 0.04) return 'HIGH';
  if (v >= 0.02) return 'MID';
  return 'LOW';
}
