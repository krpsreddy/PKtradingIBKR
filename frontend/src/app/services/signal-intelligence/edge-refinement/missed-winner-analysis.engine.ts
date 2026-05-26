import { SuppressionSimulationResult, MissedWinnerInsight } from './suppression-validation.models';

/** Identify suppressed signals that would have been strong winners. */
export class MissedWinnerAnalysisEngine {

  analyze(simulations: SuppressionSimulationResult[]): MissedWinnerInsight[] {
    return simulations
      .filter(s => s.removedWinners > 0 && s.deltas.missedWinners > 0)
      .map(s => ({
        ruleId: s.ruleId,
        ruleLabel: s.ruleLabel,
        missedCount: s.deltas.missedWinners,
        missedExpectancyR: s.deltas.missedExpectancyR,
        missedHighRCount: s.deltas.missedHighRTrades,
        examples: this.examples(s)
      }))
      .filter(m => m.missedCount >= 2)
      .sort((a, b) => b.missedExpectancyR - a.missedExpectancyR)
      .slice(0, 8);
  }

  private examples(sim: SuppressionSimulationResult): string[] {
    if (sim.deltas.missedHighRTrades > 0) {
      return [`${sim.deltas.missedHighRTrades} high-R winners (≥1.5R MFE) would be filtered`];
    }
    return [`${sim.deltas.missedWinners} winners removed (+${sim.deltas.missedExpectancyR.toFixed(2)}R)`];
  }
}
