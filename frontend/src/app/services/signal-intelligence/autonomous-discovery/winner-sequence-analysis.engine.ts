import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import { PreExpansionFeatureVector } from './autonomous-discovery.models';
import { PreExpansionFeatureExtractorEngine } from './pre-expansion-feature-extractor.engine';
import {
  confidenceTier,
  groupBySession,
  isBigDollarWinner,
  isEliteWinner,
  mfeR,
  round2,
  sessionDateFromTs
} from './autonomous-discovery.util';

export interface WinnerSequenceInsight {
  winnerId: string;
  symbol: string;
  sessionDate: string;
  outcomeR: number;
  priorSignalCount: number;
  preExpansionFeatures: PreExpansionFeatureVector;
  preExpansionNotes: string[];
}

/** Analyze what existed BEFORE elite expansion winners fired. */
export class WinnerSequenceAnalysisEngine {
  private readonly extractor = new PreExpansionFeatureExtractorEngine();

  analyze(signals: SignalSnapshot[]): WinnerSequenceInsight[] {
    const evaluated = evaluatedSignals(signals);
    const ctx = this.extractor.buildContext(evaluated);
    const sessions = groupBySession(evaluated);
    const out: WinnerSequenceInsight[] = [];

    for (const [, rows] of sessions) {
      const winners = rows.filter(s => isEliteWinner(s) || isBigDollarWinner(s));
      for (const w of winners) {
        const prior = rows.filter(s => s.timestamp < w.timestamp);
        const notes = this.preExpansionNotes(prior, w);
        out.push({
          winnerId: w.id,
          symbol: w.symbol,
          sessionDate: sessionDateFromTs(w.timestamp),
          outcomeR: round2(mfeR(w)),
          priorSignalCount: prior.length,
          preExpansionFeatures: this.extractor.extract(w, ctx),
          preExpansionNotes: notes
        });
      }
    }

    return out.sort((a, b) => b.outcomeR - a.outcomeR).slice(0, 50);
  }

  aggregatePreConditions(insights: WinnerSequenceInsight[]): {
    note: string;
    presencePct: number;
    avgR: number;
    count: number;
  }[] {
    if (!insights.length) return [];
    const noteCounts = new Map<string, { n: number; r: number }>();
    for (const i of insights) {
      for (const note of i.preExpansionNotes) {
        const b = noteCounts.get(note) ?? { n: 0, r: 0 };
        b.n++;
        b.r += i.outcomeR;
        noteCounts.set(note, b);
      }
    }
    const total = insights.length;
    return [...noteCounts.entries()]
      .map(([note, { n, r }]) => ({
        note,
        presencePct: pct(n, total),
        avgR: round2(r / n),
        count: n
      }))
      .sort((a, b) => b.presencePct - a.presencePct)
      .slice(0, 12);
  }

  private preExpansionNotes(prior: SignalSnapshot[], winner: SignalSnapshot): string[] {
    const notes: string[] = [];
    const wRvol = winner.rvol ?? 0;
    const priorRvol = prior.length
      ? prior.reduce((n, s) => n + (s.rvol ?? 0), 0) / prior.length
      : 0;

    if (wRvol >= 2.5) notes.push('elevated relative volume at entry');
    if (wRvol > priorRvol * 1.3 && prior.length) notes.push('volume acceleration vs session baseline');
    if ((winner.vwapDistance ?? 0) >= -0.002) notes.push('acceptance at/above VWAP');
    if ((winner.trendAlignment ?? 0) >= 60) notes.push('strong relative strength');
    if ((winner.sessionTimeMinutes ?? 999) <= 30) notes.push('early session expansion window');
    if (Math.abs(winner.vwapDistance ?? 0) < 0.008) notes.push('shallow pullback depth');
    if (winner.emaAlignment) notes.push('EMA structure aligned');
    if (!winner.extendedEntry) notes.push('non-extended capture location');
    if ((winner.convictionScore ?? 0) >= 55) notes.push('conviction above session median');
    if (prior.length >= 2) notes.push('multi-step session progression before expansion');
    return notes.slice(0, 6);
  }
}
