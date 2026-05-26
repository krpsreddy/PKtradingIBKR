import { SymbolEdgeCompressedSummary } from './models/symbol-edge.models';
import {
  DnaConfidence,
  EdgeScoreBand,
  FakeoutTendency,
  SymbolDnaProfile,
  dnaConfidenceFromSamples,
  edgeScoreBandFromScore
} from './models/symbol-dna.models';
import { computeEdgeScore } from './symbol-edge-score.engine';
import { deriveSymbolPersonality } from './symbol-personality.engine';

/** Deterministic symbol personality & execution refinement — reuses shared edge stats. */
export class SymbolDnaEngine {

  build(summary: SymbolEdgeCompressedSummary, aiSummary?: string | null): SymbolDnaProfile {
    const n = summary.evaluatedTrades;
    const edgeScore = computeEdgeScore(summary);
    const band = edgeScoreBandFromScore(edgeScore);

    const bestSetups = [...summary.bySetup]
      .filter(s => s.sample >= 5)
      .sort((a, b) => b.expectancy - a.expectancy)
      .slice(0, 4);

    const worstSetups = [...summary.bySetup]
      .filter(s => s.sample >= 5)
      .sort((a, b) => a.expectancy - b.expectancy)
      .slice(0, 4);

    const reclaim = summary.bySetup.find(s =>
      s.type.toUpperCase().includes('RECLAIM') || s.type.toUpperCase().includes('VWAP')
    );

    return {
      symbol: summary.symbol,
      personality: deriveSymbolPersonality(summary, aiSummary),
      edgeScore,
      edgeScoreBand: band,
      continuationQuality: continuationQuality(summary),
      fakeoutTendency: fakeoutTendency(summary),
      reclaimQuality: reclaim && reclaim.sample >= 5 ? reclaim.expectancy : null,
      confidence: dnaConfidenceFromSamples(n),
      sampleCount: n,
      expectancy: summary.overall.expectancy,
      winRate: summary.overall.winRate,
      bestSetups,
      worstSetups,
      timingBehavior: summary.byTimeOfDay.slice(0, 5),
      regimeBehavior: summary.byRegime.slice(0, 5),
      preferredConditions: preferredConditions(summary, bestSetups),
      avoidConditions: avoidConditions(summary, worstSetups)
    };
  }
}

function continuationQuality(summary: SymbolEdgeCompressedSummary): number {
  const hit1 = summary.overall.hit1RRate ?? 0;
  const mfe = summary.overall.avgMfe ?? 0;
  return Math.round(Math.min(100, hit1 * 0.6 + mfe * 25));
}

function fakeoutTendency(summary: SymbolEdgeCompressedSummary): FakeoutTendency {
  const late = summary.lateEntryPenalty.expectancyDropPct;
  const mae = Math.abs(summary.overall.avgMae);
  if (late > 25 || mae > 0.9) return 'HIGH';
  if (late > 12 || mae > 0.55) return 'MODERATE';
  return 'LOW';
}

function preferredConditions(
  summary: SymbolEdgeCompressedSummary,
  best: SymbolDnaProfile['bestSetups']
): string[] {
  const out: string[] = [];
  for (const s of best.filter(b => b.expectancy > 0).slice(0, 3)) {
    out.push(`${s.type} (+${s.expectancy.toFixed(2)}R, n=${s.sample})`);
  }
  if (summary.bestRegime && summary.bestRegime.expectancy > 0) {
    out.push(`${summary.bestRegime.name} regime alignment`);
  }
  if (summary.bestTimeWindow && summary.bestTimeWindow !== '—') {
    out.push(`Timing: ${summary.bestTimeWindow}`);
  }
  return out.length ? out : ['Insufficient samples — load history first'];
}

function avoidConditions(
  summary: SymbolEdgeCompressedSummary,
  worst: SymbolDnaProfile['worstSetups']
): string[] {
  const out: string[] = [];
  for (const s of worst.filter(w => w.expectancy < 0).slice(0, 3)) {
    out.push(`${s.type} (${s.expectancy.toFixed(2)}R, n=${s.sample})`);
  }
  if (summary.worstRegime && summary.worstRegime.expectancy < 0) {
    out.push(`${summary.worstRegime.name} regime — negative expectancy`);
  }
  if (summary.lateEntryPenalty.expectancyDropPct > 15) {
    out.push('Late / chase entries');
  }
  return out.length ? out : ['No clear avoid patterns yet'];
}
