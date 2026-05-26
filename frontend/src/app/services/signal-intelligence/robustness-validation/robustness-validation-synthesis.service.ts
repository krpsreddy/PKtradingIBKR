import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { evaluatedSignals } from '../signal-intelligence.math';
import { AutonomousDiscoverySynthesisService } from '../autonomous-discovery/autonomous-discovery-synthesis.service';
import { HistoricalPatternMinerEngine } from '../autonomous-discovery/historical-pattern-miner.engine';
import { UnsupervisedStrategyClusteringEngine } from '../autonomous-discovery/unsupervised-strategy-clustering.engine';
import { isEliteWinner } from '../autonomous-discovery/autonomous-discovery.util';
import {
  RobustnessClassification,
  RobustnessValidationReport,
  StrategyRobustnessRow
} from './robustness-validation.models';
import { RegimeValidationEngine } from './regime-validation.engine';
import { SymbolGeneralizationEngine } from './symbol-generalization.engine';
import { ContinuationStabilityEngine } from './continuation-stability.engine';
import { OutlierDependencyEngine } from './outlier-dependency.engine';
import { WalkforwardValidationEngine } from './walkforward-validation.engine';
import { CrossSymbolConsistencyEngine } from './cross-symbol-consistency.engine';
import { RobustnessScoreEngine } from './robustness-score.engine';
import { avgR, topSymbols, winRate } from './robustness-validation.util';
import { IntelligenceOffloadService } from '../../intelligence-offload/intelligence-offload.service';

/** Phase 161 — robustness & regime validation orchestrator (advisory only). */
@Injectable({ providedIn: 'root' })
export class RobustnessValidationSynthesisService {
  private readonly miner = new HistoricalPatternMinerEngine();
  private readonly clustering = new UnsupervisedStrategyClusteringEngine();
  private readonly regime = new RegimeValidationEngine();
  private readonly symbol = new SymbolGeneralizationEngine();
  private readonly continuation = new ContinuationStabilityEngine();
  private readonly outlier = new OutlierDependencyEngine();
  private readonly walkforward = new WalkforwardValidationEngine();
  private readonly crossSymbol = new CrossSymbolConsistencyEngine();
  private readonly scorer = new RobustnessScoreEngine();

  private readonly reportSubject = new BehaviorSubject<RobustnessValidationReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(
    private store: SignalIntelligenceStore,
    private discovery: AutonomousDiscoverySynthesisService,
    private offload: IntelligenceOffloadService
  ) {
    this.offload.bindRevisionRefresh(() => this.refresh(), this.store.revision$);
    this.refresh();
  }

  snapshot(): RobustnessValidationReport | null {
    return this.reportSubject.value;
  }

  refresh(
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
    filter: SignalIntelligenceFilter = {}
  ): RobustnessValidationReport {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = evaluatedSignals(this.store.query({ ...filter, fromTs }));
    const n = signals.length;

    const mined = this.miner.mine(signals, 3);
    const eliteMined = this.miner.eliteBuckets(signals);
    const allBuckets = [...mined];
    for (const b of eliteMined) {
      if (!allBuckets.some(x => x.key === b.key)) allBuckets.push(b);
    }
    const clusters = this.clustering.cluster(allBuckets, 1);
    const discoveryReport = this.discovery.snapshot();
    const strategyByName = new Map((discoveryReport?.discoveredStrategies ?? []).map(s => [s.name, s]));

    const strategyRobustness: StrategyRobustnessRow[] = [];
    const regimeBreakdowns: RobustnessValidationReport['regimeBreakdowns'] = [];
    const outlierAnalysis: RobustnessValidationReport['outlierAnalysis'] = [];
    const walkforwardValidation: RobustnessValidationReport['walkforwardValidation'] = [];
    const generalizationMetrics: RobustnessValidationReport['generalizationMetrics'] = [];
    const crossSymbolStability: RobustnessValidationReport['crossSymbolStability'] = [];
    const continuationPersistenceStability: RobustnessValidationReport['continuationPersistenceStability'] = [];

    for (const cluster of clusters) {
      if (cluster.sampleCount < 5) continue;
      const name = strategyByName.has(cluster.name)
        ? cluster.name
        : cluster.name;
      const metrics = this.scorer.evaluate(name, cluster.signals);
      const gen = this.symbol.analyze(name, cluster.signals);

      strategyRobustness.push({
        strategyId: cluster.clusterId,
        strategyName: name,
        sampleCount: cluster.sampleCount,
        winRate: winRate(cluster.signals),
        avgR: avgR(cluster.signals),
        robustnessScore: metrics.robustnessScore,
        generalizationScore: metrics.generalizationScore,
        regimeConsistency: metrics.regimeConsistency,
        outlierDependency: metrics.outlierDependency,
        walkforwardDecay: metrics.walkforwardDecay,
        continuationPersistenceQuality: metrics.continuationPersistenceQuality,
        classification: metrics.classification,
        uniqueSymbols: gen.uniqueSymbols,
        topSymbols: topSymbols(cluster.signals),
        advisoryNote: this.scorer.advisoryNote(metrics.classification, metrics)
      });

      const regimeResult = this.regime.analyze(name, cluster.signals);
      regimeBreakdowns.push(...regimeResult.rows);
      outlierAnalysis.push(this.outlier.analyze(name, cluster.signals));
      walkforwardValidation.push(this.walkforward.analyze(name, cluster.signals));
      generalizationMetrics.push(gen);
      crossSymbolStability.push(...this.crossSymbol.analyze(name, cluster.signals));
      continuationPersistenceStability.push(this.continuation.analyze(name, cluster.signals));
    }

    strategyRobustness.sort((a, b) => b.robustnessScore - a.robustnessScore);

    const report: RobustnessValidationReport = {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: Date.now(),
      totalEvaluated: n,
      strategyRobustness,
      regimeBreakdowns,
      outlierAnalysis,
      walkforwardValidation,
      generalizationMetrics,
      crossSymbolStability,
      continuationPersistenceStability,
      robustStrategies: strategyRobustness.filter(s =>
        s.classification === 'ROBUST' || s.classification === 'LIKELY_ROBUST'
      ),
      regimeDependent: strategyRobustness.filter(s => s.classification === 'REGIME_DEPENDENT'),
      symbolDependent: strategyRobustness.filter(s => s.classification === 'SYMBOL_DEPENDENT'),
      overfitRiskLeaderboard: strategyRobustness
        .filter(s => s.classification === 'OVERFIT_RISK' || s.classification === 'OUTLIER_DEPENDENT')
        .sort((a, b) => a.robustnessScore - b.robustnessScore),
      summaryInsights: this.buildInsights(n, strategyRobustness, signals.filter(isEliteWinner).length)
    };

    this.reportSubject.next(report);
    return report;
  }

  /** Live safety multiplier 0.55–1.0 — diagnostic only, never disables. */
  confidenceMultiplier(strategyName: string | null | undefined): number {
    if (!strategyName) return 1;
    const row = this.reportSubject.value?.strategyRobustness.find(
      s => s.strategyName === strategyName || s.strategyId === strategyName
    );
    if (!row) return 1;
    return this.scorer.confidenceMultiplier(row.classification);
  }

  classificationFor(strategyName: string | null | undefined): RobustnessClassification | null {
    if (!strategyName) return null;
    return this.reportSubject.value?.strategyRobustness.find(
      s => s.strategyName === strategyName || s.strategyId === strategyName
    )?.classification ?? null;
  }

  private buildInsights(
    n: number,
    rows: StrategyRobustnessRow[],
    elite: number
  ): string[] {
    const lines: string[] = [];
    if (n < 10) lines.push('Insufficient evaluated sample — hydrate 60D history before trusting robustness scores.');
    const robust = rows.filter(r => r.classification === 'ROBUST' || r.classification === 'LIKELY_ROBUST').length;
    const overfit = rows.filter(r => r.classification === 'OVERFIT_RISK' || r.classification === 'OUTLIER_DEPENDENT').length;
    lines.push(`${rows.length} autonomous clusters validated · ${robust} robust/likely-robust · ${overfit} overfit/outlier flags.`);
    lines.push(`${elite} elite (+2R) winners in sample — outlier and walk-forward tests applied.`);
    lines.push('OVERFIT_RISK and OUTLIER_DEPENDENT reduce participation confidence — strategies are not auto-disabled.');
    lines.push('Advisory only — no threshold mutation, auto sizing, or self-modifying strategies.');
    return lines;
  }
}
