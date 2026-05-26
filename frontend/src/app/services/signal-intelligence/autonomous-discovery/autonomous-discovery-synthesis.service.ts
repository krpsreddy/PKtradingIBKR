import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { AnalyticsSyncService } from '../persistent-analytics/analytics-sync.service';
import { PersistentEvaluatedSignalService } from '../persistent-analytics/persistent-evaluated-signal.service';
import { evaluatedSignals } from '../signal-intelligence.math';
import { AutonomousDiscoveryReport, ExpansionClusterRow, ReplayDiscoveryExample } from './autonomous-discovery.models';
import { HistoricalPatternMinerEngine } from './historical-pattern-miner.engine';
import { PreExpansionFeatureExtractorEngine } from './pre-expansion-feature-extractor.engine';
import { UnsupervisedStrategyClusteringEngine } from './unsupervised-strategy-clustering.engine';
import { WinnerSequenceAnalysisEngine } from './winner-sequence-analysis.engine';
import { EntryArchetypeDiscoveryEngine } from './entry-archetype-discovery.engine';
import { PullbackPatternDiscoveryEngine } from './pullback-pattern-discovery.engine';
import { ContinuationRegimeMinerEngine } from './continuation-regime-miner.engine';
import { StatisticalEdgeRankingEngine } from './statistical-edge-ranking.engine';
import {
  confidenceTier,
  inferIdealEntryZone,
  isEliteWinner,
  mfeR,
  sessionDateFromTs
} from './autonomous-discovery.util';

/** Phase 158 — autonomous strategy discovery orchestrator (advisory only). */
@Injectable({ providedIn: 'root' })
export class AutonomousDiscoverySynthesisService {
  private readonly miner = new HistoricalPatternMinerEngine();
  private readonly extractor = new PreExpansionFeatureExtractorEngine();
  private readonly clustering = new UnsupervisedStrategyClusteringEngine();
  private readonly winnerSeq = new WinnerSequenceAnalysisEngine();
  private readonly archetypes = new EntryArchetypeDiscoveryEngine();
  private readonly pullbacks = new PullbackPatternDiscoveryEngine();
  private readonly regimes = new ContinuationRegimeMinerEngine();
  private readonly ranking = new StatisticalEdgeRankingEngine();

  private readonly reportSubject = new BehaviorSubject<AutonomousDiscoveryReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(
    private store: SignalIntelligenceStore,
    private analyticsSync: AnalyticsSyncService,
    private persistentSignals: PersistentEvaluatedSignalService
  ) {
    this.store.revision$.subscribe(() => this.refresh());
    void this.ensureLoadedAndRefresh();
  }

  snapshot(): AutonomousDiscoveryReport | null {
    return this.reportSubject.value;
  }

  /** Bootstrap PostgreSQL → local store, then mine patterns. */
  async ensureLoadedAndRefresh(
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
    filter: SignalIntelligenceFilter = {}
  ): Promise<AutonomousDiscoveryReport> {
    if (!this.analyticsSync.state().bootstrapped) {
      await this.analyticsSync.bootstrap();
    }

    let report = this.refresh(lookbackDays, filter);
    if (report.totalEvaluated >= 10) {
      return report;
    }

    await this.analyticsSync.ensureServerHasSnapshots({ symbol: filter.symbol });

    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const server = await this.persistentSignals.loadAll({
      symbol: filter.symbol,
      fromTs,
      pageSize: 500
    });
    if (server.length) {
      this.store.mergeFromServer(server);
    }

    if (!this.analyticsSync.state().bootstrapped) {
      await this.analyticsSync.bootstrap();
    }

    return this.refresh(lookbackDays, filter);
  }

  refresh(
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
    filter: SignalIntelligenceFilter = {}
  ): AutonomousDiscoveryReport {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs });
    const evaluated = evaluatedSignals(signals);
    const n = evaluated.length;
    const ctx = this.extractor.buildContext(evaluated);

    const mined = this.miner.mine(evaluated, 3);
    const eliteMined = this.miner.eliteBuckets(evaluated);
    const allBuckets = [...mined];
    for (const b of eliteMined) {
      if (!allBuckets.some(x => x.key === b.key)) allBuckets.push(b);
    }

    const clusters = this.clustering.cluster(allBuckets, 1);
    const discoveredStrategies = this.ranking.rank(
      this.archetypes.discover(clusters, ctx.breakpoints)
    );
    const eliteCount = evaluated.filter(isEliteWinner).length;

    const report: AutonomousDiscoveryReport = {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: Date.now(),
      totalEvaluated: n,
      eliteWinnerCount: eliteCount,
      discoveredStrategies,
      topExpansionClusters: this.expansionRows(clusters),
      hiddenContinuationPatterns: this.regimes.hiddenPatterns(clusters, ctx.breakpoints),
      optimalPullbackStructures: this.pullbacks.discover(evaluated),
      institutionalExpansionProfiles: this.regimes.institutionalProfiles(evaluated),
      strategyFeatureImportance: this.ranking.featureImportance(clusters),
      governanceSuppressedPatterns: this.ranking.governanceConflicts(clusters, n),
      preExpansionConditions: this.regimes.preExpansionConditions(evaluated),
      idealEntryZones: this.archetypes.idealEntryZoneStats(clusters),
      replayExamples: this.replayExamples(clusters, discoveredStrategies),
      summaryInsights: this.buildInsights(n, eliteCount, discoveredStrategies.length, clusters.length)
    };

    this.reportSubject.next(report);
    return report;
  }

  private expansionRows(clusters: ReturnType<UnsupervisedStrategyClusteringEngine['cluster']>): ExpansionClusterRow[] {
    return clusters
      .filter(c => c.kind === 'EXPANSION_CLUSTER' || c.avgR >= 2)
      .slice(0, 12)
      .map(c => ({
        clusterId: c.clusterId,
        name: c.name,
        kind: c.kind,
        sampleCount: c.sampleCount,
        avgR: c.avgR,
        avgDollar: c.avgDollar,
        topSymbols: [...new Set(c.signals.map(s => s.symbol))].slice(0, 5),
        confidence: c.confidence
      }));
  }

  private replayExamples(
    clusters: ReturnType<UnsupervisedStrategyClusteringEngine['cluster']>,
    strategies: AutonomousDiscoveryReport['discoveredStrategies']
  ): ReplayDiscoveryExample[] {
    const out: ReplayDiscoveryExample[] = [];
    const strategyById = new Map(strategies.map(s => [s.id, s]));

    for (const c of clusters.slice(0, 8)) {
      const strat = strategyById.get(c.clusterId);
      const best = c.signals.slice().sort((a, b) => mfeR(b) - mfeR(a))[0];
      if (!best) continue;
      out.push({
        signalId: best.id,
        symbol: best.symbol,
        sessionDate: sessionDateFromTs(best.timestamp),
        timestamp: best.timestamp,
        strategyId: c.clusterId,
        strategyName: c.name,
        outcomeR: mfeR(best),
        idealEntryZone: strat?.idealEntryZone ?? inferIdealEntryZone(c.centroid)
      });
    }
    return out;
  }

  private buildInsights(
    n: number,
    elite: number,
    discovered: number,
    clusterCount: number
  ): string[] {
    const lines: string[] = [];
    if (n < 10) lines.push('Insufficient evaluated sample — hydrate 60D history before trusting discoveries.');
    else if (n < 25) lines.push(`Low confidence (${n} evaluated) — discoveries are directional only.`);
    lines.push(`${discovered} profitable entry archetypes discovered from ${clusterCount} unsupervised clusters.`);
    lines.push(`${elite} elite (+2R) winners mined for pre-expansion condition analysis.`);
    lines.push('Discovery uses numeric feature vectors — not legacy signal-type labels.');
    lines.push('Advisory only — no auto-trading, threshold mutation, or strategy activation.');
    return lines;
  }
}
