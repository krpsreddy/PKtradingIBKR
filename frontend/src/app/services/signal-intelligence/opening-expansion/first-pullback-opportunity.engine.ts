import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import { OpeningExpansionInput } from './opening-expansion.models';
import { mfeR } from './opening-expansion.util';

/** Identify first controlled pullback add opportunities on trend days. */
export class FirstPullbackOpportunityEngine {

  isFirstPullbackAdd(input: OpeningExpansionInput): boolean {
    const mins = input.sessionTimeMinutes ?? 999;
    const t = input.signalType.toUpperCase();
    if (mins < 8 || mins > 45) return false;
    if (!t.includes('PULL') && !t.includes('CONT') && t !== 'MOM_READY') return false;
    if (input.extended) return false;
    return (input.rvol ?? 0) >= 1.2 && (input.vwapDistance ?? -1) >= -0.008;
  }

  analyze(signals: SignalSnapshot[]): {
    label: string;
    count: number;
    winRate: number;
    avgR: number;
    continuationPct: number;
    fakeoutPct: number;
  }[] {
    const opening = evaluatedSignals(signals);
    const adds = opening.filter(s => this.isFirstPullbackAdd({
      symbol: s.symbol,
      signalType: s.signalType,
      sessionTimeMinutes: s.sessionTimeMinutes,
      rvol: s.rvol,
      vwapDistance: s.vwapDistance,
      extended: s.extendedEntry,
      score: s.convictionScore ?? undefined
    }));

    if (!adds.length) return [];

    const wins = adds.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5);
    const cont = adds.filter(s => mfeR(s) >= 1.5);
    const fake = adds.filter(s => (s.evaluation?.maeR ?? 0) <= -0.8);

    return [{
      label: 'First pullback add zone',
      count: adds.length,
      winRate: pct(wins.length, adds.length),
      avgR: adds.length ? Math.round(adds.reduce((n, s) => n + mfeR(s), 0) / adds.length * 100) / 100 : 0,
      continuationPct: pct(cont.length, adds.length),
      fakeoutPct: pct(fake.length, adds.length)
    }];
  }
}
