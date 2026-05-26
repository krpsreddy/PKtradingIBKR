import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter,
  SignalSnapshot
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { confidenceFromCount, evaluatedSignals } from '../signal-intelligence.math';
import { EntryAcceptanceSequencingEngine } from './entry-acceptance-sequencing.engine';
import { AcceptanceTransitionEngine } from './acceptance-transition.engine';
import { ReclaimAcceptanceValidationEngine } from './reclaim-acceptance-validation.engine';
import { PullbackStabilityEngine } from './pullback-stability.engine';
import { ContinuationAcceptanceEngine } from './continuation-acceptance.engine';
import { SecondLegConfirmationEngine } from './second-leg-confirmation.engine';
import { ExecutionSequencingSimulationEngine } from './execution-sequencing-simulation.engine';
import { SequencingRegretAnalysisEngine } from './sequencing-regret-analysis.engine';
import {
  AcceptanceMatrixRow,
  ContinuationAcceptanceLevel,
  EntryAcceptanceState,
  EntrySequencingReport,
  EntrySequencingSynthesisLine,
  LiveEntrySequencingInput,
  LiveEntrySequencingIntel
} from './entry-sequencing.models';
import { MIN_AUTHORITATIVE_SAMPLE, MIN_LOW_CONFIDENCE_SAMPLE } from './entry-sequencing.util';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { computeExpectancyR, pct } from '../signal-intelligence.math';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Phase 142 orchestrator — entry acceptance sequencing (advisory only). */
@Injectable({ providedIn: 'root' })
export class EntrySequencingSynthesisService {
  private readonly sequencer = new EntryAcceptanceSequencingEngine();
  private readonly transitionEngine = new AcceptanceTransitionEngine();
  private readonly reclaimEngine = new ReclaimAcceptanceValidationEngine();
  private readonly pullbackEngine = new PullbackStabilityEngine();
  private readonly continuationEngine = new ContinuationAcceptanceEngine();
  private readonly secondLegEngine = new SecondLegConfirmationEngine();
  private readonly simulationEngine = new ExecutionSequencingSimulationEngine();
  private readonly regretEngine = new SequencingRegretAnalysisEngine();

  private readonly reportSubject = new BehaviorSubject<EntrySequencingReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(private store: SignalIntelligenceStore) {
    this.store.revision$.subscribe(() => this.refresh());
  }

  snapshot(): EntrySequencingReport | null {
    return this.reportSubject.value;
  }

  refresh(filter: SignalIntelligenceFilter = {}): EntrySequencingReport {
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs });
    return this.buildReport(signals, lookbackDays);
  }

  liveIntel(input: LiveEntrySequencingInput): LiveEntrySequencingIntel {
    const sym = input.symbol.toUpperCase();
    const fromTs = Date.now() - SIGNAL_INTELLIGENCE_LOOKBACK_DAYS * 86_400_000;
    const historical = this.store.query({ symbol: sym, fromTs });
    const n = evaluatedSignals(historical).length;
    const snapshot = this.sequencer.buildSnapshot(input);
    const currentState = this.sequencer.liveState(input);
    const pullback = this.pullbackEngine.classify(snapshot);
    const continuation = this.continuationEngine.classify(snapshot);
    const fakeoutRisk = this.fakeoutRisk(currentState, continuation);
    const compactLine = this.compactLine(currentState, pullback, continuation, fakeoutRisk);
    const governanceHint = this.governanceHint(currentState, continuation, fakeoutRisk);

    return {
      currentState,
      compactLine,
      detailLines: [`State: ${currentState.replace(/_/g, ' ')}`, `Pullback: ${pullback}`, `Continuation: ${continuation.replace(/_/g, ' ')}`],
      pullbackStability: pullback,
      continuationAcceptance: continuation,
      fakeoutRisk,
      governanceHint,
      authoritative: n >= MIN_AUTHORITATIVE_SAMPLE,
      advisoryOnly: true
    };
  }

  private buildReport(signals: ReturnType<SignalIntelligenceStore['query']>, lookbackDays: number): EntrySequencingReport {
    const evaluated = evaluatedSignals(signals);
    const { paths, transitions, commonPaths } = this.transitionEngine.analyze(signals);
    const reclaimAcceptance = this.reclaimEngine.analyze(signals);
    const pullbackStability = this.pullbackEngine.analyze(signals);
    const continuationAcceptance = this.continuationEngine.analyze(signals);
    const secondLeg = this.secondLegEngine.analyze(signals);
    const simulations = this.simulationEngine.simulateAll(signals);
    const regret = this.regretEngine.analyze(signals);
    const acceptanceMatrix = this.buildMatrix(signals);
    const synthesis = this.synthesize(reclaimAcceptance, simulations, regret, evaluated.length);

    const report: EntrySequencingReport = {
      lookbackDays,
      totalEvaluated: evaluated.length,
      generatedAt: Date.now(),
      evolutionPaths: paths.slice(0, 50),
      commonPaths,
      transitions,
      reclaimAcceptance,
      pullbackStability,
      continuationAcceptance,
      secondLeg,
      simulations,
      regret,
      acceptanceMatrix,
      synthesis,
      advisoryOnly: true
    };

    this.reportSubject.next(report);
    return report;
  }

  private buildMatrix(signals: SignalSnapshot[]): AcceptanceMatrixRow[] {
    const evaluated = evaluatedSignals(signals);
    const levels: ContinuationAcceptanceLevel[] = [
      'VERY_STRONG_ACCEPTANCE', 'STRONG_ACCEPTANCE', 'NEUTRAL_ACCEPTANCE',
      'WEAK_ACCEPTANCE', 'FAILING_ACCEPTANCE'
    ];
    const rows: AcceptanceMatrixRow[] = [];

    for (const level of levels) {
      for (const setup of unique(evaluated.map(s => s.signalType))) {
        for (const regime of unique(evaluated.map(s => s.marketRegime))) {
          const bucket = evaluated.filter(s =>
            this.continuationEngine.classify(s) === level
            && s.signalType === setup
            && s.marketRegime === regime
          );
          if (bucket.length < 2) continue;
          const falseOnes = bucket.filter(s => falseBreakout.isFalseBreakout(s));
          const cont = bucket.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
          rows.push({
            acceptance: level,
            setup,
            regime,
            sampleCount: bucket.length,
            expectancyR: computeExpectancyR(bucket),
            fakeoutRate: pct(falseOnes.length, bucket.length),
            continuationQuality: pct(cont.length, bucket.length),
            sustainability: pct(bucket.filter(s => s.evaluation!.hit1R).length, bucket.length),
            confidence: confidenceFromCount(bucket.length)
          });
        }
      }
    }

    return rows.sort((a, b) => b.expectancyR - a.expectancyR).slice(0, 20);
  }

  private synthesize(
    reclaim: ReturnType<ReclaimAcceptanceValidationEngine['analyze']>,
    simulations: ReturnType<ExecutionSequencingSimulationEngine['simulateAll']>,
    regret: ReturnType<SequencingRegretAnalysisEngine['analyze']>,
    n: number
  ): EntrySequencingSynthesisLine[] {
    const conf = confidenceFromCount(n);
    const lines: EntrySequencingSynthesisLine[] = [];

    if (reclaim.sampleCount >= MIN_AUTHORITATIVE_SAMPLE && reclaim.continuationRate >= 45) {
      lines.push({
        id: 'reclaim-stabilize',
        headline: 'Continuation improves significantly after reclaim stabilization.',
        detail: `Reclaim continuation ${reclaim.continuationRate}% · hold ${reclaim.holdRate}%`,
        confidence: conf
      });
    }

    const failedSim = simulations.find(s => s.presetId === 'RECLAIM_HOLD');
    if (failedSim && failedSim.baseline.fakeoutRate - failedSim.sequenced.fakeoutRate > 8) {
      lines.push({
        id: 'failed-breakouts',
        headline: 'Most failed breakouts never achieve continuation acceptance.',
        detail: `Instant fakeout ${failedSim.baseline.fakeoutRate}% vs sequenced ${failedSim.sequenced.fakeoutRate}%`,
        confidence: conf
      });
    }

    const bestSim = simulations.sort((a, b) => b.deltas.expectancyR - a.deltas.expectancyR)[0];
    if (bestSim && bestSim.deltas.expectancyR > 0.05) {
      lines.push({
        id: 'delayed-entry',
        headline: 'Delayed entries reduce fakeouts but sacrifice early expansion.',
        detail: `${bestSim.presetLabel}: ${bestSim.deltas.expectancyR >= 0 ? '+' : ''}${bestSim.deltas.expectancyR.toFixed(2)}R · missed ${bestSim.deltas.missedWinners} winners`,
        confidence: conf
      });
    }

    const breadthSim = simulations.find(s => s.presetId === 'BREADTH_CONFIRM');
    if (breadthSim && breadthSim.sequenced.sampleCount >= MIN_LOW_CONFIDENCE_SAMPLE && breadthSim.sequenced.expectancyR > 0.15) {
      lines.push({
        id: 'breadth-survives',
        headline: 'Strong breadth continuation survives moderate extension.',
        detail: `Breadth-confirmed expectancy ${breadthSim.sequenced.expectancyR.toFixed(2)}R`,
        confidence: conf
      });
    }

    const regretRow = regret.rows.sort((a, b) => b.expectancyGained - a.expectancyGained)[0];
    if (regretRow && regretRow.fakeoutsAvoided > 3) {
      lines.push({
        id: 'regret',
        headline: `Waiting (${regretRow.bestWindow}) avoids ~${regretRow.fakeoutsAvoided} fakeouts per sample.`,
        detail: `Expectancy gained ${regretRow.expectancyGained.toFixed(2)}R · ${regretRow.improvedByWaiting} improved paths`,
        confidence: conf
      });
    }

    return lines.slice(0, 8);
  }

  private compactLine(
    state: EntryAcceptanceState,
    pullback: ReturnType<PullbackStabilityEngine['classify']>,
    continuation: ContinuationAcceptanceLevel,
    fakeout: 'LOW' | 'MEDIUM' | 'HIGH'
  ): string {
    const fake = fakeout === 'LOW' ? 'LOW FAKEOUT' : fakeout === 'HIGH' ? 'TRAP RISK HIGH' : 'MOD FAKEOUT';

    switch (state) {
      case 'WAITING_FOR_ACCEPTANCE':
      case 'RECLAIM_IN_PROGRESS':
        return `WAIT FOR ACCEPTANCE · RECLAIM NOT CONFIRMED · ${fake}`;
      case 'RECLAIM_CONFIRMED':
        if (continuation.includes('STRONG')) return `RECLAIM CONFIRMED · CONTINUATION ACCEPTED · FULL EDGE`;
        return `RECLAIM CONFIRMED · WATCH CONTINUATION · ${fake}`;
      case 'PULLBACK_STABILIZING':
        return `PULLBACK STABILIZING · WATCH SECOND LEG · ${fake}`;
      case 'CONTINUATION_ACCEPTED':
        return `CONTINUATION ACCEPTED · ${pullback === 'VERY_STABLE' ? 'FULL EDGE' : 'REDUCE SIZE'}`;
      case 'SECOND_LEG_CONFIRMED':
        return `SECOND LEG CONFIRMED · IDEAL CONTINUATION · ${fake}`;
      case 'OVEREXTENDED':
        return continuation.includes('STRONG') ? `EXTENDED BUT ACCEPTED · REDUCE SIZE` : `OVEREXTENDED · ${fake}`;
      case 'EXHAUSTING':
      case 'FAILED_ACCEPTANCE':
        return `FAILED ACCEPTANCE · ${fake}`;
      case 'LIQUIDITY_SWEEP':
      case 'REJECTED':
        return `FAILED ACCEPTANCE · TRAP RISK HIGH`;
      default:
        return `EARLY TRIGGER · WAIT FOR PROOF · ${fake}`;
    }
  }

  private fakeoutRisk(state: EntryAcceptanceState, continuation: ContinuationAcceptanceLevel): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (state === 'FAILED_ACCEPTANCE' || state === 'LIQUIDITY_SWEEP' || state === 'REJECTED') return 'HIGH';
    if (continuation === 'FAILING_ACCEPTANCE' || state === 'EXHAUSTING') return 'HIGH';
    if (continuation === 'WEAK_ACCEPTANCE' || state === 'OVEREXTENDED') return 'MEDIUM';
    if (continuation === 'VERY_STRONG_ACCEPTANCE' || state === 'SECOND_LEG_CONFIRMED') return 'LOW';
    return 'MEDIUM';
  }

  private governanceHint(
    state: EntryAcceptanceState,
    continuation: ContinuationAcceptanceLevel,
    fakeout: 'LOW' | 'MEDIUM' | 'HIGH'
  ): string {
    if (state === 'SECOND_LEG_CONFIRMED' || continuation === 'VERY_STRONG_ACCEPTANCE') {
      return 'Full size eligible with governance approval';
    }
    if (state === 'WAITING_FOR_ACCEPTANCE' || state === 'RECLAIM_IN_PROGRESS' || state === 'PULLBACK_STABILIZING') {
      return 'Wait for acceptance confirmation — do not chase';
    }
    if (fakeout === 'HIGH' || state === 'FAILED_ACCEPTANCE') {
      return 'Suppress or minimal size — human approval required';
    }
    return 'Reduced size until continuation acceptance confirmed';
  }
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
