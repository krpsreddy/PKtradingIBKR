import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  DailyEdgeDiscoveryReport,
  EdgeDiscoveryAiSummary
} from './edge-discovery.models';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { EdgeDiscoveryEngine } from './edge-discovery.engine';
import { BadConditionEliminationEngine } from './bad-condition-elimination.engine';
import { EdgeDecayAnalyticsEngine } from './edge-decay-analytics.engine';
import { SymbolCapitalRankingEngine } from './symbol-capital-ranking.engine';
import {
  buildCompressedPayload,
  synthesizeEdgeDiscovery
} from './execution-edge-gate.service';
import { EdgeDiscoveryAiSynthesisService } from './edge-discovery-ai-synthesis.service';

@Injectable({ providedIn: 'root' })
export class DailyEdgeDiscoveryReportService {
  private readonly discoveryEngine = new EdgeDiscoveryEngine();
  private readonly eliminationEngine = new BadConditionEliminationEngine();
  private readonly decayEngine = new EdgeDecayAnalyticsEngine();
  private readonly rankingEngine = new SymbolCapitalRankingEngine();

  private readonly reportSubject = new BehaviorSubject<DailyEdgeDiscoveryReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(
    private store: SignalIntelligenceStore,
    private aiSynthesis: EdgeDiscoveryAiSynthesisService
  ) {
    this.store.revision$.subscribe(() => this.refresh());
    this.refresh();
  }

  snapshot(): DailyEdgeDiscoveryReport | null {
    return this.reportSubject.value;
  }

  refresh(lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS, filter: SignalIntelligenceFilter = {}): DailyEdgeDiscoveryReport {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs });
    const report = this.buildReport(signals, lookbackDays);
    this.reportSubject.next(report);
    return report;
  }

  async refreshWithAi(
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
    filter: SignalIntelligenceFilter = {}
  ): Promise<DailyEdgeDiscoveryReport> {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs });
    const report = await this.buildReportAsync(signals, lookbackDays);
    this.reportSubject.next(report);
    return report;
  }

  async buildReportAsync(signals: ReturnType<SignalIntelligenceStore['query']>, lookbackDays: number): Promise<DailyEdgeDiscoveryReport> {
    const base = this.buildReport(signals, lookbackDays);
    const ai = await this.aiSynthesis.synthesize(base, buildCompressedPayload(base));
    return { ...base, aiSummary: ai };
  }

  private buildReport(signals: ReturnType<SignalIntelligenceStore['query']>, lookbackDays: number): DailyEdgeDiscoveryReport {
    const discovery = this.discoveryEngine.discover(signals, lookbackDays);
    const eliminations = this.eliminationEngine.analyze(discovery.clusters);
    const decay = this.decayEngine.analyze(signals, lookbackDays);
    const symbolRankings = this.rankingEngine.rank(signals);

    const timeClusters = discovery.clusters
      .filter(c => c.timeWindow)
      .sort((a, b) => b.metrics.expectancyR - a.metrics.expectancyR);

    const base: DailyEdgeDiscoveryReport = {
      lookbackDays,
      generatedAt: Date.now(),
      discovery,
      eliminations,
      decay,
      symbolRankings,
      strongestConditions: discovery.highEdge.slice(0, 8),
      weakestConditions: [...discovery.clusters].sort((a, b) => a.metrics.expectancyR - b.metrics.expectancyR).slice(0, 8),
      bestSetups: discovery.clusters.filter(c => !c.regime).sort((a, b) => b.metrics.expectancyR - a.metrics.expectancyR).slice(0, 6),
      toxicConditions: discovery.toxic,
      bestSymbols: symbolRankings.filter(s => s.capitalRank === 'HIGH' || s.capitalRank === 'MODERATE').slice(0, 8),
      weakeningEdges: decay.weakening,
      risingFakeoutEnvironments: decay.risingFakeout,
      recommendedSuppressions: eliminations,
      bestTimeWindows: timeClusters.slice(0, 6),
      aiSummary: synthesizeEdgeDiscovery({
        lookbackDays,
        generatedAt: Date.now(),
        discovery,
        eliminations,
        decay,
        symbolRankings,
        strongestConditions: discovery.highEdge,
        weakestConditions: [],
        bestSetups: [],
        toxicConditions: discovery.toxic,
        bestSymbols: symbolRankings,
        weakeningEdges: decay.weakening,
        risingFakeoutEnvironments: decay.risingFakeout,
        recommendedSuppressions: eliminations,
        bestTimeWindows: timeClusters,
        aiSummary: { summary: '', strongestEdge: '', topToxic: '', capitalGuidance: '', suppressions: [], anomalies: [], provider: 'local', fallbackUsed: true }
      })
    };

    return base;
  }
}
