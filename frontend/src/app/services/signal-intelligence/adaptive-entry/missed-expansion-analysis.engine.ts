import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { ExecutionSequencingSimulationEngine, SEQUENCING_PRESETS } from '../entry-sequencing/execution-sequencing-simulation.engine';
import { MissedExpansionRow } from './adaptive-entry.models';
import { round2 } from './adaptive-entry.util';

/** Analyze where waiting missed too much expansion. */
export class MissedExpansionAnalysisEngine {
  private readonly simulation = new ExecutionSequencingSimulationEngine();

  analyze(signals: SignalSnapshot[]): MissedExpansionRow[] {
    const presetNotes: Record<string, string> = {
      RECLAIM_HOLD: 'Lower fakeout but may miss first continuation leg',
      PULLBACK_STABLE: 'Safer entry but missed early expansion',
      SECOND_LEG: 'Best survival but missed first expansion leg',
      BREADTH_CONFIRM: 'Breadth filter reduces fakeouts with modest expansion cost'
    };

    return SEQUENCING_PRESETS.map(preset => {
      const sim = this.simulation.simulate(signals, preset);
      const missedExpansionPct = round2(Math.max(0, -sim.deltas.continuationRate) + sim.deltas.missedWinners * 8);
      const fakeoutReduction = round2(-sim.deltas.fakeoutRate);

      return {
        waitStrategy: preset.label,
        sampleCount: sim.sequenced.sampleCount,
        fakeoutReductionPct: fakeoutReduction,
        missedExpansionPct: Math.min(80, missedExpansionPct),
        expectancyGainR: round2(sim.deltas.expectancyR),
        note: presetNotes[preset.id] ?? 'Waiting alters expansion capture vs instant entry'
      };
    }).sort((a, b) => b.expectancyGainR - a.expectancyGainR);
  }
}
