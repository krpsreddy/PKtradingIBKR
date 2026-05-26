import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import { OpeningExpansionInput } from './opening-expansion.models';
import { OPENING_WINDOW_MIN } from './opening-expansion.util';

/** Measure trend-day persistence after first 15 minutes. */
export class TrendDayPersistenceEngine {

  persistenceScore(input: OpeningExpansionInput): number {
    let s = 50;
    const rvol = input.rvol ?? 0;
    if (rvol >= 2 && rvol <= 6) s += 15;
    if ((input.vwapDistance ?? 0) >= 0) s += 12;
    if ((input.trendAlignment ?? 0) >= 55) s += 10;
    if (input.signalType.includes('MOM') || input.signalType.includes('CONT')) s += 15;
    if (input.extended) s -= 18;
    if ((input.sessionTimeMinutes ?? 0) > 15 && (input.sessionTimeMinutes ?? 0) <= 60) s += 8;
    return Math.max(0, Math.min(100, s));
  }

  analyze(signals: SignalSnapshot[]): { label: string; count: number; avgR: number; persistencePct: number }[] {
    const opening = evaluatedSignals(signals.filter(s => (s.sessionTimeMinutes ?? 999) < OPENING_WINDOW_MIN));
    const strong = opening.filter(s => this.persistenceScore(snapshotInput(s)) >= 60);
    const weak = opening.filter(s => this.persistenceScore(snapshotInput(s)) < 45);

    return [
      bucket('High persistence opening', strong),
      bucket('Low persistence opening', weak)
    ].filter(b => b.count > 0);
  }
}

function bucket(label: string, rows: SignalSnapshot[]) {
  const persist = rows.filter(s => (s.evaluation?.mfeR ?? 0) >= 2);
  const avgR = rows.length
    ? rows.reduce((n, s) => n + (s.evaluation?.mfeR ?? 0), 0) / rows.length
    : 0;
  return {
    label,
    count: rows.length,
    avgR: Math.round(avgR * 100) / 100,
    persistencePct: rows.length ? pct(persist.length, rows.length) : 0
  };
}

function snapshotInput(s: SignalSnapshot): OpeningExpansionInput {
  return {
    symbol: s.symbol,
    signalType: s.signalType,
    sessionTimeMinutes: s.sessionTimeMinutes,
    rvol: s.rvol,
    vwapDistance: s.vwapDistance,
    trendAlignment: s.trendAlignment,
    extended: s.extendedEntry,
    score: s.convictionScore ?? undefined
  };
}
