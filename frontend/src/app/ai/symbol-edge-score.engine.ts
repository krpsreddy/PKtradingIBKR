import { SymbolEdgeCompressedSummary } from './models/symbol-edge.models';

/**
 * Weighted edge score 0–100 from deterministic stats.
 * Factors: expectancy, sample size, win rate, low MAE, regime stability.
 */
export function computeEdgeScore(summary: SymbolEdgeCompressedSummary): number {
  if (summary.evaluatedTrades === 0) return 0;

  const { overall, byRegime, worstRegime } = summary;

  const expScore = clamp((overall.expectancy + 0.5) * 40, 0, 40);
  const sampleScore = clamp((summary.evaluatedTrades / 50) * 25, 0, 25);
  const wrScore = clamp(overall.winRate * 0.15, 0, 15);
  const maeScore = clamp((1 - Math.abs(overall.avgMae) / 1.2) * 10, 0, 10);

  let regimeScore = 5;
  const eligible = byRegime.filter(r => r.sample >= 3);
  if (eligible.length >= 2) {
    const spread = Math.max(...eligible.map(r => r.expectancy)) - Math.min(...eligible.map(r => r.expectancy));
    regimeScore = clamp((1 - spread / 1.5) * 10, 0, 10);
  } else if (worstRegime && worstRegime.expectancy >= 0) {
    regimeScore = 10;
  }

  return Math.round(clamp(expScore + sampleScore + wrScore + maeScore + regimeScore, 0, 100));
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
