import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { ExpansionCaptureReport, ExpansionCaptureRow } from './adaptive-calibration.models';
import { ExecutionSequencingSimulationEngine, SEQUENCING_PRESETS } from '../entry-sequencing/execution-sequencing-simulation.engine';
import { expansionCapturePct, isFakeout, round2 } from './adaptive-calibration.util';

/** Measure how much move is missed due to waiting vs aggressive entry. */
export class ExpansionCaptureEfficiencyEngine {
  private readonly simulation = new ExecutionSequencingSimulationEngine();

  analyze(signals: SignalSnapshot[]): ExpansionCaptureReport {
    const evaluated = evaluatedSignals(signals);
    const instantCapture = avg(evaluated.map(expansionCapturePct));
    const instantExp = computeExpectancyR(evaluated);
    const instantFakeout = pct(evaluated.filter(isFakeout).length, evaluated.length);

    const pullbackSim = this.simulation.simulate(signals, SEQUENCING_PRESETS.find(p => p.id === 'PULLBACK_STABLE')!);
    const secondLegSim = this.simulation.simulate(signals, SEQUENCING_PRESETS.find(p => p.id === 'SECOND_LEG')!);

    const rows = [
      {
        style: 'AGGRESSIVE' as const,
        label: 'Aggressive (instant entry)',
        sampleCount: evaluated.length,
        capturePct: round2(instantCapture),
        fakeoutRate: instantFakeout,
        continuationSurvival: pct(evaluated.filter(s => (s.evaluation?.mfeR ?? 0) >= 1).length, evaluated.length),
        expectancyR: instantExp,
        confidence: confidenceFromCount(evaluated.length)
      },
      {
        style: 'PATIENT' as const,
        label: 'Patient (pullback wait)',
        sampleCount: pullbackSim.sequenced.sampleCount,
        capturePct: round2(Math.max(20, instantCapture - Math.max(0, -pullbackSim.deltas.continuationRate) - pullbackSim.deltas.missedWinners * 4)),
        fakeoutRate: round2(pullbackSim.sequenced.fakeoutRate),
        continuationSurvival: round2(pullbackSim.sequenced.continuationRate),
        expectancyR: round2(pullbackSim.sequenced.expectancyR),
        confidence: confidenceFromCount(pullbackSim.sequenced.sampleCount)
      },
      {
        style: 'SECOND_LEG_ACCEPTANCE' as const,
        label: 'Second-leg acceptance',
        sampleCount: secondLegSim.sequenced.sampleCount,
        capturePct: round2(Math.max(30, instantCapture - Math.max(0, -secondLegSim.deltas.continuationRate) * 0.5)),
        fakeoutRate: round2(secondLegSim.sequenced.fakeoutRate),
        continuationSurvival: round2(secondLegSim.sequenced.continuationRate),
        expectancyR: round2(secondLegSim.sequenced.expectancyR),
        confidence: confidenceFromCount(secondLegSim.sequenced.sampleCount)
      }
    ] satisfies ExpansionCaptureRow[];

    const sorted = [...rows].sort((a, b) => b.capturePct - a.capturePct);

    const bestCaptureStyle = sorted.find(r => r.sampleCount >= 10)?.style ?? null;

    return { rows: sorted, bestCaptureStyle, advisoryOnly: true };
  }
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}
