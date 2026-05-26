import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals } from '../signal-intelligence.math';
import { ExecutionSequencingSimulationEngine, SEQUENCING_PRESETS } from '../entry-sequencing/execution-sequencing-simulation.engine';
import { WaitVsActComparison, WaitVsActReport } from './decision-feedback.models';
import { round2 } from './decision-feedback.util';

/** Compare instant entry vs wait-for-acceptance / pullback / second-leg strategies. */
export class WaitVsActEngine {
  private readonly simulation = new ExecutionSequencingSimulationEngine();

  analyze(signals: SignalSnapshot[]): WaitVsActReport {
    const evaluated = evaluatedSignals(signals);
    const baselineExpectancyR = computeExpectancyR(evaluated);

    const presetMap: Record<string, { strategy: string; strategyId: string }> = {
      RECLAIM_HOLD: { strategy: 'Wait for Acceptance', strategyId: 'WAIT_FOR_ACCEPTANCE' },
      PULLBACK_STABLE: { strategy: 'Wait for Pullback', strategyId: 'WAIT_FOR_PULLBACK' },
      SECOND_LEG: { strategy: 'Wait for Second Leg', strategyId: 'WAIT_FOR_SECOND_LEG' },
      BREADTH_CONFIRM: { strategy: 'Instant Entry (baseline)', strategyId: 'INSTANT' }
    };

    const comparisons: WaitVsActComparison[] = SEQUENCING_PRESETS.map(preset => {
      const sim = this.simulation.simulate(signals, preset);
      const meta = presetMap[preset.id] ?? { strategy: preset.label, strategyId: preset.id };

      return {
        strategy: meta.strategy,
        strategyId: meta.strategyId,
        sampleCount: sim.sequenced.sampleCount,
        instantExpectancyR: round2(baselineExpectancyR),
        waitExpectancyR: round2(sim.sequenced.expectancyR),
        expectancyImprovementR: round2(sim.deltas.expectancyR),
        fakeoutReductionPct: round2(-sim.deltas.fakeoutRate),
        continuationImprovementPct: round2(sim.deltas.continuationRate),
        missedWinnerCostR: round2(sim.deltas.missedWinners * 0.5),
        confidence: confidenceFromCount(sim.sequenced.sampleCount)
      };
    }).sort((a, b) => b.expectancyImprovementR - a.expectancyImprovementR);

    const best = comparisons[0];
    const summary = best && best.expectancyImprovementR > 0
      ? `Waiting (${best.strategy}) improved expectancy by ${best.expectancyImprovementR >= 0 ? '+' : ''}${best.expectancyImprovementR.toFixed(2)}R but missed early expansion on ~${Math.round(best.missedWinnerCostR / 0.5)} winners.`
      : 'Instant entry baseline — waiting did not materially improve expectancy in this window.';

    return {
      baselineExpectancyR: round2(baselineExpectancyR),
      comparisons,
      summary,
      advisoryOnly: true
    };
  }
}
