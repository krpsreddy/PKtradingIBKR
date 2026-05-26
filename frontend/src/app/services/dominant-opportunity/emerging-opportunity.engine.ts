import { ConvictionSample } from './dominant-opportunity.models';

const WINDOW_MS = 20_000;
const FAST_DELTA = 12;

/** Detect conviction acceleration over ~15–20s. */
export function convictionDelta(
  symbol: string,
  conviction: number,
  history: Map<string, ConvictionSample[]>,
  now = Date.now()
): number {
  const samples = history.get(symbol) ?? [];
  const recent = samples.filter(s => now - s.at <= WINDOW_MS);
  if (recent.length < 2) return 0;
  const oldest = recent[0];
  return Math.round(conviction - oldest.conviction);
}

export function isEmergingFast(delta: number, popVelocity: number): boolean {
  return delta >= FAST_DELTA || (delta >= 8 && popVelocity >= 22);
}

export function recordConvictionSample(
  history: Map<string, ConvictionSample[]>,
  symbol: string,
  conviction: number,
  now = Date.now()
): void {
  const sym = symbol.toUpperCase();
  const prev = history.get(sym) ?? [];
  const next = [...prev, { at: now, conviction }].filter(s => now - s.at <= 120_000);
  if (next.length > 40) next.splice(0, next.length - 40);
  history.set(sym, next);
}
