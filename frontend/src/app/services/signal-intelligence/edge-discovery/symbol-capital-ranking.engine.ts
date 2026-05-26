import { CapitalRank, EdgeScoreBand, SymbolCapitalRank } from './edge-discovery.models';
import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals } from '../signal-intelligence.math';
import {
  computeAdaptiveEdgeScore,
  computeClusterMetrics,
  edgeScoreBand
} from './edge-cluster-metrics.util';

/** Ranks symbols for selective capital allocation — advisory only. */
export class SymbolCapitalRankingEngine {

  rank(signals: SignalSnapshot[]): SymbolCapitalRank[] {
    const symbols = [...new Set(signals.map(s => s.symbol.toUpperCase()))];
    const ranks: SymbolCapitalRank[] = [];

    for (const symbol of symbols) {
      const symSignals = signals.filter(s => s.symbol.toUpperCase() === symbol);
      const evaluated = evaluatedSignals(symSignals);
      if (evaluated.length < 5) continue;

      const metrics = computeClusterMetrics(symSignals);
      const exp = computeExpectancyR(symSignals);
      const stability = this.stability(symSignals);
      const edgeScore = computeAdaptiveEdgeScore(metrics, stability);
      const band = edgeScoreBand(edgeScore);

      ranks.push({
        symbol,
        edgeScore,
        edgeScoreBand: band,
        capitalRank: capitalRankFromScore(edgeScore, exp),
        expectancyR: exp,
        sampleCount: evaluated.length,
        fakeoutRate: metrics.fakeoutRate,
        stability: Math.round(stability * 100)
      });
    }

    return ranks.sort((a, b) => b.edgeScore - a.edgeScore);
  }

  private stability(signals: SignalSnapshot[]): number {
    const evaluated = evaluatedSignals(signals);
    if (evaluated.length < 10) return 0.4;
    const mid = evaluated[Math.floor(evaluated.length / 2)]?.timestamp ?? 0;
    const early = evaluated.filter(s => s.timestamp < mid);
    const late = evaluated.filter(s => s.timestamp >= mid);
    if (early.length < 5 || late.length < 5) return 0.5;
    const eEarly = computeExpectancyR(early);
    const eLate = computeExpectancyR(late);
    const drift = Math.abs(eEarly - eLate);
    return Math.max(0, Math.min(1, 1 - drift / 0.5));
  }
}

function capitalRankFromScore(score: number, exp: number): CapitalRank {
  if (score >= 75 && exp > 0.1) return 'HIGH';
  if (score >= 55 && exp > 0) return 'MODERATE';
  if (score >= 35) return 'REDUCED';
  return 'AVOID';
}

export function scoreBandLabel(band: EdgeScoreBand): string {
  switch (band) {
    case 'AGGRESSIVE': return '80+ AGGRESSIVE';
    case 'FAVORABLE': return '65–80 FAVORABLE';
    case 'SELECTIVE': return '50–65 SELECTIVE';
    case 'REDUCE_SIZE': return '35–50 REDUCE SIZE';
    default: return '<35 NO EDGE';
  }
}
