import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { OpeningExpansionClassification, OpeningExpansionInput } from './opening-expansion.models';
import { EarlyExpansionQualificationEngine } from './early-expansion-qualification.engine';
import { OPENING_WINDOW_MIN } from './opening-expansion.util';

/** Classify institutional opening expansion vs retail exhaustion days. */
export class InstitutionalOpeningDriveEngine {
  private readonly qualify = new EarlyExpansionQualificationEngine();

  classify(input: OpeningExpansionInput): OpeningExpansionClassification {
    const q = this.qualify.qualify(input);
    if (q.retailExhaustion) return 'RETAIL_EXHAUSTION';
    if (q.institutional && q.score >= 55) return 'INSTITUTIONAL_EXPANSION';
    if (q.orbAcceptance && q.noImmediateRejection) return 'CONTROLLED_DIGESTION';
    return 'NEUTRAL_OPENING';
  }

  analyzeSessions(signals: SignalSnapshot[]): {
    label: OpeningExpansionClassification;
    count: number;
    winRate: number;
    avgR: number;
    continuationPct: number;
    fakeoutPct: number;
  }[] {
    const opening = evaluatedSignals(signals.filter(s => (s.sessionTimeMinutes ?? 999) < OPENING_WINDOW_MIN));
    const buckets = new Map<OpeningExpansionClassification, SignalSnapshot[]>();

    for (const s of opening) {
      const input = snapshotToInput(s, opening.length);
      const c = this.classify(input);
      buckets.set(c, [...(buckets.get(c) ?? []), s]);
    }

    return [...buckets.entries()].map(([label, rows]) => {
      const wins = rows.filter(r => r.evaluation?.status === 'WIN' || (r.evaluation?.mfeR ?? 0) >= 0.5);
      const cont = rows.filter(r => (r.evaluation?.mfeR ?? 0) >= 1);
      const fake = rows.filter(r => (r.evaluation?.maeR ?? 0) <= -0.8 && (r.evaluation?.mfeR ?? 0) < 0.3);
      return {
        label,
        count: rows.length,
        winRate: rows.length ? pct(wins.length, rows.length) : 0,
        avgR: rows.length ? round(computeExpectancyR(rows)) : 0,
        continuationPct: rows.length ? pct(cont.length, rows.length) : 0,
        fakeoutPct: rows.length ? pct(fake.length, rows.length) : 0
      };
    }).sort((a, b) => b.avgR - a.avgR);
  }
}

function snapshotToInput(s: SignalSnapshot, n: number): OpeningExpansionInput {
  return {
    symbol: s.symbol,
    signalType: s.signalType,
    sessionTimeMinutes: s.sessionTimeMinutes,
    rvol: s.rvol,
    vwapDistance: s.vwapDistance,
    trendAlignment: s.trendAlignment,
    extended: s.extendedEntry,
    score: s.convictionScore ?? undefined,
    marketRegime: s.marketRegime,
    sampleCount: n
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
