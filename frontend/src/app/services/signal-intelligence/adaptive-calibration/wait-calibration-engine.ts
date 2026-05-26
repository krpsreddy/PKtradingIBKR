import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals } from '../signal-intelligence.math';
import { ExecutionSequencingSimulationEngine, SEQUENCING_PRESETS } from '../entry-sequencing/execution-sequencing-simulation.engine';
import { WaitCalibrationReport, WaitCalibrationRow } from './adaptive-calibration.models';
import { round2 } from './adaptive-calibration.util';

const WAIT_MAP: Record<string, { waitType: WaitCalibrationRow['waitType']; label: string }> = {
  RECLAIM_HOLD: { waitType: 'WAIT_FOR_ACCEPTANCE', label: 'Wait for Acceptance' },
  PULLBACK_STABLE: { waitType: 'WAIT_FOR_PULLBACK', label: 'Wait for Pullback' },
  SECOND_LEG: { waitType: 'WAIT_FOR_SECOND_LEG', label: 'Wait for Second Leg' },
  BREADTH_CONFIRM: { waitType: 'WAIT_FOR_RECLAIM_HOLD', label: 'Wait for Reclaim Hold' }
};

/** Determine where waiting helps vs harms expansion capture. */
export class WaitCalibrationEngine {
  private readonly simulation = new ExecutionSequencingSimulationEngine();

  analyze(signals: SignalSnapshot[]): WaitCalibrationReport {
    const evaluated = evaluatedSignals(signals);
    const baseline = computeExpectancyR(evaluated);

    const rows: WaitCalibrationRow[] = SEQUENCING_PRESETS.map(preset => {
      const sim = this.simulation.simulate(signals, preset);
      const meta = WAIT_MAP[preset.id] ?? { waitType: 'WAIT_FOR_ACCEPTANCE' as const, label: preset.label };
      const missedExpansionPct = round2(Math.max(0, -sim.deltas.continuationRate) + sim.deltas.missedWinners * 6);
      const fakeoutReductionPct = round2(-sim.deltas.fakeoutRate);
      const expectancyDeltaR = round2(sim.deltas.expectancyR);

      let aggressiveness: WaitCalibrationRow['aggressiveness'] = 'INSUFFICIENT';
      if (sim.sequenced.sampleCount >= 10) {
        if (missedExpansionPct > 40 && fakeoutReductionPct < 5) aggressiveness = 'TOO_PATIENT';
        else if (missedExpansionPct < 20 && fakeoutReductionPct > 8) aggressiveness = 'BALANCED';
        else if (missedExpansionPct > 35) aggressiveness = 'TOO_PATIENT';
        else aggressiveness = 'TOO_AGGRESSIVE';
      }

      return {
        waitType: meta.waitType,
        label: meta.label,
        sampleCount: sim.sequenced.sampleCount,
        fakeoutReductionPct,
        continuationImprovementPct: round2(sim.deltas.continuationRate),
        missedExpansionPct: Math.min(80, missedExpansionPct),
        expectancyDeltaR,
        aggressiveness,
        confidence: confidenceFromCount(sim.sequenced.sampleCount)
      };
    }).sort((a, b) => b.expectancyDeltaR - a.expectancyDeltaR);

    const balanced = rows.find(r => r.aggressiveness === 'BALANCED');
    const optimalAggressiveness = balanced?.aggressiveness
      ?? (rows[0]?.missedExpansionPct > 45 ? 'TOO_PATIENT' : 'BALANCED');

    const best = rows[0];
    const summary = best && best.expectancyDeltaR > 0
      ? `${best.label} improves fakeout avoidance but sacrifices ~${best.missedExpansionPct}% expansion capture.`
      : 'Waiting and instant entry are balanced — no dominant wait strategy in this window.';

    return { rows, optimalAggressiveness, summary, advisoryOnly: true };
  }
}
