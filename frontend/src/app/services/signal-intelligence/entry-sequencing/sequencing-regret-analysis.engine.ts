import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals } from '../signal-intelligence.math';
import { SequencingRegretReport, SequencingRegretRow } from './entry-sequencing.models';
import {
  ExecutionSequencingSimulationEngine,
  SEQUENCING_PRESETS
} from './execution-sequencing-simulation.engine';
import { deriveStateSequence, pathImproved } from './entry-sequencing.util';

/** Analyze entries improved vs worsened by waiting for acceptance. */
export class SequencingRegretAnalysisEngine {
  private readonly simulation = new ExecutionSequencingSimulationEngine();

  analyze(signals: SignalSnapshot[]): SequencingRegretReport {
    const evaluated = evaluatedSignals(signals);
    const rows: SequencingRegretRow[] = SEQUENCING_PRESETS.map(preset => {
      const sim = this.simulation.simulate(signals, preset);
      const improved = evaluated.filter(s => pathImproved(deriveStateSequence(s)));
      const worsened = evaluated.filter(s => {
        const st = deriveStateSequence(s);
        return st.includes('FAILED_ACCEPTANCE') || st.includes('EXHAUSTING');
      });

      return {
        presetId: preset.id,
        improvedByWaiting: improved.length,
        worsenedByWaiting: worsened.length,
        missedContinuation: sim.deltas.missedWinners,
        fakeoutsAvoided: Math.round(Math.abs(Math.min(0, sim.deltas.fakeoutRate)) * sim.baseline.sampleCount / 100),
        expectancyGained: sim.deltas.expectancyR,
        bestWindow: preset.id === 'RECLAIM_HOLD' ? '5–15m after reclaim'
          : preset.id === 'SECOND_LEG' ? '15–30m second push'
          : '5m pullback hold'
      };
    });

    return { rows, advisoryOnly: true };
  }
}
