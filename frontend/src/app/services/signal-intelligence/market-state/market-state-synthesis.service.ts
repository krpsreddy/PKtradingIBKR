import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { evaluatedSignals } from '../signal-intelligence.math';
import { MarketStateMachineEngine } from './market-state-machine.engine';
import { ExecutionNarrativeEngine } from './execution-narrative.engine';
import { StateTransitionExpectancyEngine } from './state-transition-expectancy.engine';
import { NarrativeQualityEngine } from './narrative-quality.engine';
import { TransitionFailureEngine } from './transition-failure.engine';
import { InstitutionalFlowEngine } from './institutional-flow.engine';
import { NarrativePlaybookEngine } from './narrative-playbook.engine';
import { LiveMarketStateInput, LiveMarketStateIntel, MarketNarrativeReport } from './market-state.models';
import {
  deriveLiveMarketStateSequence,
  finalMarketState,
  flowLabel,
  inferLiveInstitutionalFlow,
  inferTrajectory,
  MIN_AUTHORITATIVE,
  MIN_LOW_CONFIDENCE,
  stateLabel,
  trajectoryLabel
} from './market-state.util';

/** Phase 145 orchestrator — market narrative intelligence (advisory only). */
@Injectable({ providedIn: 'root' })
export class MarketStateSynthesisService {
  private readonly machine = new MarketStateMachineEngine();
  private readonly narrative = new ExecutionNarrativeEngine();
  private readonly expectancy = new StateTransitionExpectancyEngine();
  private readonly quality = new NarrativeQualityEngine();
  private readonly failures = new TransitionFailureEngine();
  private readonly flow = new InstitutionalFlowEngine();
  private readonly playbooks = new NarrativePlaybookEngine();

  private readonly reportSubject = new BehaviorSubject<MarketNarrativeReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(private store: SignalIntelligenceStore) {
    this.store.revision$.subscribe(() => this.refresh());
  }

  snapshot(): MarketNarrativeReport | null {
    return this.reportSubject.value;
  }

  refresh(filter: SignalIntelligenceFilter = {}): MarketNarrativeReport {
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs });
    return this.buildReport(signals, lookbackDays);
  }

  liveIntel(input: LiveMarketStateInput): LiveMarketStateIntel {
    const states = deriveLiveMarketStateSequence(input);
    const current = finalMarketState(states);
    const trajectory = inferTrajectory(states);
    const institutionalFlow = inferLiveInstitutionalFlow(input, states);
    const path = { states, transitions: [], current, trajectory };
    const narrativeLine = this.narrative.narrate(path);
    const compactLine = this.narrative.railLine(path);
    const quality = this.quality.scoreLive(states, input.trendAlignment ?? 50);
    const n = input.sampleCount ?? 0;

    return {
      currentState: current,
      statePath: states,
      trajectory,
      trajectoryLabel: trajectoryLabel(trajectory),
      narrativeLine,
      compactLine,
      institutionalFlow,
      flowLabel: flowLabel(institutionalFlow),
      narrativeQuality: quality,
      detailLines: [
        `${trajectoryLabel(trajectory)} · ${flowLabel(institutionalFlow)}`,
        `Quality ${quality}/100 · ${stateLabel(current)}`
      ],
      authoritative: n >= MIN_AUTHORITATIVE,
      advisoryOnly: true
    };
  }

  pathForSignal(signal: ReturnType<SignalIntelligenceStore['query']>[0]) {
    return this.machine.path(signal);
  }

  private buildReport(signals: ReturnType<SignalIntelligenceStore['query']>, lookbackDays: number): MarketNarrativeReport {
    const evaluated = evaluatedSignals(signals);
    const transitionExpectancy = this.expectancy.analyze(signals);
    const allPlaybooks = this.playbooks.discover(signals);
    const flowSummary = this.flow.summarize(signals);
    const transitionFailures = this.failures.analyze(signals);

    const bestNarratives = allPlaybooks.filter(p => p.verdict === 'BEST').slice(0, 8);
    const dangerousNarratives = allPlaybooks.filter(p => p.verdict === 'DANGEROUS').slice(0, 6);

    const stableNarratives = bestNarratives
      .filter(p => p.stability >= 60 && p.fakeoutRate <= 20)
      .map(p => p.label);
    const unstableNarratives = dangerousNarratives
      .filter(p => p.fakeoutRate >= 40)
      .map(p => p.label);

    if (!stableNarratives.length) {
      stableNarratives.push('Reclaim continuation', 'Second leg acceptance');
    }
    if (!unstableNarratives.length) {
      unstableNarratives.push('Opening breakout momentum');
    }

    const dominant = flowSummary[0];
    const secondary = flowSummary[1];
    const currentFlowHint = dominant
      ? this.flow.flowHint(dominant.flow, secondary?.flow)
      : 'Insufficient data';

    const synthesis = this.synthesize(bestNarratives, dangerousNarratives, transitionExpectancy, evaluated.length);

    const report: MarketNarrativeReport = {
      lookbackDays,
      totalEvaluated: evaluated.length,
      bestNarratives,
      dangerousNarratives,
      stableNarratives,
      unstableNarratives,
      transitionExpectancy: this.expectancy.topPaths(transitionExpectancy, 12),
      transitionFailures,
      institutionalFlowSummary: flowSummary,
      currentFlowHint,
      synthesis,
      advisoryOnly: true
    };

    this.reportSubject.next(report);
    return report;
  }

  private synthesize(
    best: MarketNarrativeReport['bestNarratives'],
    dangerous: MarketNarrativeReport['dangerousNarratives'],
    transitions: MarketNarrativeReport['transitionExpectancy'],
    n: number
  ): MarketNarrativeReport['synthesis'] {
    const lines: MarketNarrativeReport['synthesis'] = [];
    if (n < MIN_AUTHORITATIVE) return lines;

    const top = best[0];
    if (top && top.sampleCount >= MIN_LOW_CONFIDENCE) {
      lines.push({
        id: 'best-narrative',
        headline: `${top.label} is a high-expectancy narrative.`,
        detail: `${top.expectancyR >= 0 ? '+' : ''}${top.expectancyR.toFixed(2)}R · cont ${top.continuationRate}% · n=${top.sampleCount}`
      });
    }

    const danger = dangerous[0];
    if (danger && danger.sampleCount >= MIN_AUTHORITATIVE) {
      lines.push({
        id: 'danger-narrative',
        headline: `${danger.label} is a dangerous narrative pattern.`,
        detail: `${danger.expectancyR.toFixed(2)}R · fakeout ${danger.fakeoutRate}%`
      });
    }

    const path = transitions[0];
    if (path && path.sampleCount >= MIN_LOW_CONFIDENCE) {
      lines.push({
        id: 'top-path',
        headline: 'Best state transition path identified.',
        detail: `${path.pathKey.replace(/→/g, ' → ')} · ${path.expectancyR >= 0 ? '+' : ''}${path.expectancyR.toFixed(2)}R`
      });
    }

    return lines.slice(0, 6);
  }
}
