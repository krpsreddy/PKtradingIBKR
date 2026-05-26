import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SignalEdgeIntelligenceSnapshot,
  SignalIntelligenceFilter,
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalSnapshot
} from '../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from './signal-intelligence.store';
import { SignalAnalyticsService, createEmptyAnalyticsSnapshot } from './signal-analytics.service';
import { SignalConfidenceService } from './signal-confidence.service';
import { ExpectancyAnalyticsEngine } from './expectancy-analytics.engine';
import { SignalAgingAnalyticsService } from './signal-aging-analytics.service';
import { SignalFailureAnalyticsEngine } from './signal-failure-analytics.engine';
import { SignalFactorCorrelationService } from './signal-factor-correlation.service';
import { AITrainingFeatureBuilder } from './ai-training-feature.builder';
import { formatSetupLabel } from './signal-intelligence.math';
import { SetupRegimeMatrixAnalyticsEngine } from './setup-regime-matrix-analytics.engine';
import { FalseBreakoutAnalyticsEngine } from './false-breakout-analytics.engine';
import { OpeningDriveAnalyticsService } from './opening-drive-analytics.service';
import { EdgeActivationGateService } from './edge-activation-gate.service';

function createEmptyEdgeSnapshot(): SignalEdgeIntelligenceSnapshot {
  return {
    ...createEmptyAnalyticsSnapshot(),
    globalConfidence: { level: 'LOW', sampleCount: 0, label: 'LOW CONFIDENCE' },
    setupRatings: [],
    regimeExpectancy: [],
    setupExpectancy: [],
    timeframeExpectancy: [],
    aging: {
      globalWindows: [],
      bySetup: [],
      strongestEarlySetup: null,
      persistenceSetup: null,
      summaryInsight: null
    },
    failureFactors: [],
    factorCorrelations: [],
    fastestFailuresLabel: null,
    executionInsights: [],
    trainingFeatureCount: 0,
    setupRegimeMatrix: { cells: [], pivot: [], bestCombinations: [], worstCombinations: [], unstableCombinations: [], minSample: 5 },
    falseBreakout: {
      breakoutSampleCount: 0, falseBreakoutRate: 0, avgReversalBars: 0, avgReversalMinutes: 0,
      fakeoutScore: 0, trapRisk: 'LOW', continuationQuality: 50, label: 'LOW FAKEOUT RISK',
      byRegime: [], byRvol: [], byTimeOfDay: [], reversalWindowBars: 6
    },
    openingDrive: {
      openingDriveType: 'NEUTRAL', continuationProbability: 0, fadeProbability: 0,
      firstPullbackQuality: 0, label: 'NEUTRAL OPEN', sampleCount: 0, openingWindowMinutes: 15
    },
    edgeGate: {
      state: 'LOW_CONFIDENCE', label: 'LOW CONFIDENCE', reasons: ['Insufficient history'],
      expectancyR: 0, sampleCount: 0, regimeAligned: false, fakeoutAcceptable: true,
      setupStable: true, advisoryOnly: true
    }
  };
}

@Injectable({ providedIn: 'root' })
export class SignalEdgeIntelligenceService {
  private readonly expectancyEngine = new ExpectancyAnalyticsEngine();
  private readonly failureEngine = new SignalFailureAnalyticsEngine();
  private readonly featureBuilder = new AITrainingFeatureBuilder();
  private readonly matrixEngine = new SetupRegimeMatrixAnalyticsEngine();
  private readonly falseBreakoutEngine = new FalseBreakoutAnalyticsEngine();

  private readonly edgeSubject = new BehaviorSubject<SignalEdgeIntelligenceSnapshot>(
    createEmptyEdgeSnapshot()
  );
  readonly edge$ = this.edgeSubject.asObservable();

  constructor(
    private store: SignalIntelligenceStore,
    private analytics: SignalAnalyticsService,
    private confidence: SignalConfidenceService,
    private aging: SignalAgingAnalyticsService,
    private factors: SignalFactorCorrelationService,
    private openingDrive: OpeningDriveAnalyticsService,
    private edgeGate: EdgeActivationGateService
  ) {
    this.store.revision$.subscribe(() => this.refresh());
    this.refresh();
  }

  snapshot(): SignalEdgeIntelligenceSnapshot {
    return this.edgeSubject.value;
  }

  refresh(lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS): SignalEdgeIntelligenceSnapshot {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ fromTs });
    const base = this.analytics.refresh(lookbackDays);
    const edge = this.compose(signals, base);
    this.edgeSubject.next(edge);
    return edge;
  }

  queryEdge(filter: SignalIntelligenceFilter): SignalEdgeIntelligenceSnapshot {
    const signals = this.store.query(filter);
    const base = this.analytics.queryMetrics(filter);
    return this.compose(signals, base);
  }

  exportTrainingFeatures(lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS): string {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    return this.featureBuilder.exportJson(this.store.query({ fromTs }));
  }

  private compose(
    signals: SignalSnapshot[],
    base: ReturnType<SignalAnalyticsService['snapshot']>
  ): SignalEdgeIntelligenceSnapshot {
    const factorRows = this.factors.analyze(signals);
    const failureFactors = this.failureEngine.analyze(signals);
    const aging = this.aging.analyze(signals);
    const factorInsights = this.factors.topInsights(factorRows);
    const executionInsights = this.buildInsights(signals, base, failureFactors, aging, factorInsights);
    const matrix = this.matrixEngine.analyze(signals);
    const falseBreakout = this.falseBreakoutEngine.analyze(signals);
    const openingDriveSnap = this.openingDrive.analyze(signals);
    const gate = this.edgeGate.evaluate(
      signals,
      { symbol: signals[0]?.symbol ?? '—', signalType: base.bestSignalType?.signalType, marketRegime: base.bestRegime?.regime },
      matrix,
      falseBreakout,
      openingDriveSnap
    );

    if (falseBreakout.trapRisk === 'HIGH') {
      executionInsights.push(`High trap risk — ${falseBreakout.falseBreakoutRate}% false breakout rate`);
    }
    if (gate.state !== 'EDGE_ACTIVE') {
      executionInsights.push(`Edge gate: ${gate.label}`);
    }

    return {
      ...base,
      globalConfidence: this.confidence.globalConfidence(signals),
      setupRatings: this.confidence.setupRatings(signals),
      regimeExpectancy: this.expectancyEngine.byRegime(signals),
      setupExpectancy: this.expectancyEngine.bySetup(signals),
      timeframeExpectancy: this.expectancyEngine.byTimeframe(signals),
      aging,
      failureFactors,
      factorCorrelations: factorRows.slice(0, 8),
      fastestFailuresLabel: this.failureEngine.fastestFailuresLabel(signals),
      executionInsights: [...new Set(executionInsights)].slice(0, 6),
      trainingFeatureCount: this.featureBuilder.buildAll(signals).length,
      setupRegimeMatrix: matrix,
      falseBreakout,
      openingDrive: openingDriveSnap,
      edgeGate: gate
    };
  }

  private buildInsights(
    signals: SignalSnapshot[],
    base: ReturnType<SignalAnalyticsService['snapshot']>,
    failures: ReturnType<SignalFailureAnalyticsEngine['analyze']>,
    aging: ReturnType<SignalAgingAnalyticsService['analyze']>,
    factorInsights: string[]
  ): string[] {
    const insights: string[] = [...factorInsights];

    if (base.worstRegime && base.worstRegime.winRate < 45) {
      insights.push(`${base.worstRegime.regime} regime destroys performance (${base.worstRegime.winRate}% WR)`);
    }

    if (base.bestSignalType && base.bestSignalType.winRate >= 60) {
      insights.push(`${formatSetupLabel(base.bestSignalType.signalType)} shows real edge (${base.bestSignalType.winRate}% WR)`);
    }

    if (aging.summaryInsight) {
      insights.push(aging.summaryInsight);
    }

    if (failures[0]) {
      insights.push(`Top failure factor: ${failures[0].label} (${failures[0].lossCount} losses)`);
    }

    const unique = [...new Set(insights)];
    return unique.slice(0, 5);
  }
}
