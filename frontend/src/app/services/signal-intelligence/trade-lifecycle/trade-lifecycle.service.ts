import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SIGNAL_INTELLIGENCE_LOOKBACK_DAYS } from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { evaluatedSignals } from '../signal-intelligence.math';
import { OutcomeAttributionEngine } from './outcome-attribution.engine';
import { TradeManagementAnalyticsEngine, ExitQualityEngine } from './trade-management-analytics.engine';
import { ManagementStyleExpectancyEngine } from './management-style-expectancy.engine';
import { PlaybookLifecycleEngine } from './playbook-lifecycle.engine';
import { TradeLifecycleCoachingEngine } from './trade-lifecycle-coaching.engine';
import {
  LifecycleCoachSnapshot,
  TradeLifecycleIntelligenceSnapshot
} from './trade-lifecycle.models';
import { aggregateExpectancyByTiming } from './trade-lifecycle.util';

/** Phase 140 orchestrator — lifecycle intelligence + outcome attribution (advisory only). */
@Injectable({ providedIn: 'root' })
export class TradeLifecycleService {
  private readonly attributionEngine = new OutcomeAttributionEngine();
  private readonly managementEngine = new TradeManagementAnalyticsEngine();
  private readonly exitEngine = new ExitQualityEngine();
  private readonly styleEngine = new ManagementStyleExpectancyEngine();
  private readonly playbookEngine = new PlaybookLifecycleEngine();
  private readonly coachingEngine = new TradeLifecycleCoachingEngine();

  private readonly snapshotSubject = new BehaviorSubject<TradeLifecycleIntelligenceSnapshot | null>(null);
  readonly snapshot$ = this.snapshotSubject.asObservable();

  private lastSymbol = 'NVDA';

  constructor(private store: SignalIntelligenceStore) {
    this.store.revision$.subscribe(() => this.refresh(this.lastSymbol));
  }

  snapshot(): TradeLifecycleIntelligenceSnapshot | null {
    return this.snapshotSubject.value;
  }

  refresh(symbol?: string): TradeLifecycleIntelligenceSnapshot {
    if (symbol) this.lastSymbol = symbol.toUpperCase();
    const sym = this.lastSymbol;
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const symbolSignals = this.store.query({ symbol: sym, fromTs });
    const allSignals = this.store.query({ fromTs });

    const evaluated = evaluatedSignals(symbolSignals);
    const trades = evaluated
      .map(s => this.attributionEngine.buildSnapshot(s, evaluated.length))
      .sort((a, b) => b.path.timestamp - a.path.timestamp);

    const attributions = this.attributionEngine.attributeAll(symbolSignals);
    const management = this.managementEngine.analyze(symbolSignals);
    const exitQuality = this.exitEngine.aggregate(symbolSignals);
    const managementStyles = this.styleEngine.analyze(symbolSignals);
    const playbookInsights = this.playbookEngine.analyze(allSignals);
    const expectancyByTiming = aggregateExpectancyByTiming(symbolSignals);

    const coaching = this.coachingEngine.generate(
      trades,
      attributions,
      management,
      managementStyles,
      expectancyByTiming
    );

    const result: TradeLifecycleIntelligenceSnapshot = {
      symbol: sym,
      lookbackDays,
      totalEvaluated: evaluated.length,
      current: trades[0] ?? null,
      trades,
      paths: trades.map(t => t.path),
      attributions,
      management,
      exitQuality,
      managementStyles,
      playbookInsights: playbookInsights.filter(p => p.sampleCount >= 3).slice(0, 12),
      coaching,
      expectancyByTiming,
      generatedAt: Date.now(),
      advisoryOnly: true
    };

    this.snapshotSubject.next(result);
    return result;
  }

  forSymbol(symbol: string): TradeLifecycleIntelligenceSnapshot {
    return this.refresh(symbol);
  }

  coachSnapshot(symbol: string): LifecycleCoachSnapshot | null {
    const intel = this.forSymbol(symbol);
    const current = intel.current;
    if (!current) return null;

    return {
      lifecycleState: current.lifecycleState,
      continuationHealth: current.continuationHealth,
      executionQuality: current.executionQuality,
      managementQuality: current.managementQuality,
      exitQuality: current.exitQuality,
      failureReason: current.failureReason,
      attributionConfidence: current.attributionConfidence,
      coaching: this.coachingEngine.coachFromTrade(current),
      lifecycleNotes: current.lifecycleNotes,
      advisoryOnly: true
    };
  }
}
