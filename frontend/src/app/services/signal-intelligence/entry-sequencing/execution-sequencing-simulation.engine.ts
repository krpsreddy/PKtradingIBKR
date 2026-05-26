import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { avg, computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import {
  SequencingDeltas,
  SequencingMetrics,
  SequencingSimulationPreset,
  SequencingSimulationResult
} from './entry-sequencing.models';
import { deriveStateSequence, finalState, windows, w } from './entry-sequencing.util';
import { ReclaimAcceptanceValidationEngine } from './reclaim-acceptance-validation.engine';
import { PullbackStabilityEngine } from './pullback-stability.engine';
import { ContinuationAcceptanceEngine } from './continuation-acceptance.engine';
import { SecondLegConfirmationEngine } from './second-leg-confirmation.engine';
import { breadthBucket } from '../edge-discovery/edge-cluster-metrics.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

export const SEQUENCING_PRESETS: SequencingSimulationPreset[] = [
  { id: 'RECLAIM_HOLD', label: 'Wait for Reclaim Hold', description: 'Enter only after reclaim hold confirmed at 5m' },
  { id: 'PULLBACK_STABLE', label: 'Wait for Pullback Stabilization', description: 'Require stable pullback before entry' },
  { id: 'BREADTH_CONFIRM', label: 'Wait for Breadth Confirmation', description: 'Require trend alignment ≥70' },
  { id: 'SECOND_LEG', label: 'Wait for Second-Leg Acceptance', description: 'Require second-leg MFE ≥1R proxy' }
];

/** Simulate sequenced vs instant entry acceptance. */
export class ExecutionSequencingSimulationEngine {
  private readonly reclaim = new ReclaimAcceptanceValidationEngine();
  private readonly pullback = new PullbackStabilityEngine();
  private readonly continuation = new ContinuationAcceptanceEngine();
  private readonly secondLeg = new SecondLegConfirmationEngine();

  simulateAll(signals: SignalSnapshot[]): SequencingSimulationResult[] {
    return SEQUENCING_PRESETS.map(p => this.simulate(signals, p));
  }

  simulate(signals: SignalSnapshot[], preset: SequencingSimulationPreset): SequencingSimulationResult {
    const evaluated = evaluatedSignals(signals);
    const baseline = this.metrics(evaluated);
    const sequencedBucket = evaluated.filter(s => this.matchesPreset(s, preset.id));
    const removed = evaluated.filter(s => !this.matchesPreset(s, preset.id));
    const sequenced = this.metrics(sequencedBucket);
    const deltas = this.deltas(baseline, sequenced, removed, preset.id);

    return {
      presetId: preset.id,
      presetLabel: preset.label,
      baseline,
      sequenced,
      deltas,
      advisoryNote: this.note(preset, deltas),
      advisoryOnly: true
    };
  }

  private matchesPreset(s: SignalSnapshot, presetId: string): boolean {
    switch (presetId) {
      case 'RECLAIM_HOLD':
        return this.reclaim.reclaimHeld(s) || finalState(deriveStateSequence(s)) === 'RECLAIM_CONFIRMED';
      case 'PULLBACK_STABLE': {
        const pb = this.pullback.classify(s);
        return pb === 'VERY_STABLE' || pb === 'STABLE';
      }
      case 'BREADTH_CONFIRM':
        return (s.trendAlignment ?? 0) >= 70 || breadthBucket(s) === 'STRONG';
      case 'SECOND_LEG':
        return this.secondLeg.hasSecondLeg(s) || w(windows(s).w15).mfe >= 0.8;
      default:
        return false;
    }
  }

  private metrics(bucket: SignalSnapshot[]): SequencingMetrics {
    if (!bucket.length) {
      return { sampleCount: 0, winRate: 0, expectancyR: 0, fakeoutRate: 0, continuationRate: 0, avgMfeR: 0, confidence: confidenceFromCount(0) };
    }
    const wins = bucket.filter(s => s.evaluation!.status === 'WIN');
    const falseOnes = bucket.filter(s => falseBreakout.isFalseBreakout(s));
    const cont = bucket.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
    return {
      sampleCount: bucket.length,
      winRate: pct(wins.length, bucket.length),
      expectancyR: computeExpectancyR(bucket),
      fakeoutRate: pct(falseOnes.length, bucket.length),
      continuationRate: pct(cont.length, bucket.length),
      avgMfeR: avg(bucket.map(s => s.evaluation!.mfeR)),
      confidence: confidenceFromCount(bucket.length)
    };
  }

  private deltas(baseline: SequencingMetrics, sequenced: SequencingMetrics, removed: SignalSnapshot[], presetId: string): SequencingDeltas {
    const removedWinners = removed.filter(s => s.evaluation!.status === 'WIN');
    const removedExp = removed.length ? computeExpectancyR(removed) : 0;
    const delayedCost = presetId === 'SECOND_LEG' ? 0.15 : presetId === 'RECLAIM_HOLD' ? 0.08 : 0.05;

    return {
      expectancyR: round2(sequenced.expectancyR - baseline.expectancyR),
      winRate: round2(sequenced.winRate - baseline.winRate),
      fakeoutRate: round2(sequenced.fakeoutRate - baseline.fakeoutRate),
      continuationRate: round2(sequenced.continuationRate - baseline.continuationRate),
      missedWinners: removedWinners.length,
      delayedEntryCostR: round2(delayedCost),
      rrImprovement: round2(Math.max(0, sequenced.avgMfeR - baseline.avgMfeR) * 0.3)
    };
  }

  private note(preset: SequencingSimulationPreset, d: SequencingDeltas): string {
    const exp = d.expectancyR >= 0 ? `+${d.expectancyR.toFixed(2)}` : d.expectancyR.toFixed(2);
    if (d.expectancyR > 0.1 && d.fakeoutRate < -5) {
      return `${preset.label} improves expectancy ${exp}R and reduces fakeouts ${Math.abs(d.fakeoutRate).toFixed(0)}%`;
    }
    if (d.missedWinners > 5 && d.expectancyR < 0.05) {
      return `${preset.label} sacrifices ${d.missedWinners} winners — marginal improvement`;
    }
    return `${preset.label}: ${exp}R expectancy delta · fakeout ${d.fakeoutRate.toFixed(1)}%`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
