import { Injectable } from '@angular/core';
import {
  EdgeActivationGateSnapshot,
  FalseBreakoutSnapshot,
  OpeningDriveContext,
  OpeningDriveSnapshot,
  SetupRegimeMatrixSnapshot,
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS
} from '../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from './signal-intelligence.store';
import { SetupRegimeMatrixAnalyticsEngine } from './setup-regime-matrix-analytics.engine';
import { FalseBreakoutAnalyticsEngine } from './false-breakout-analytics.engine';
import { OpeningDriveAnalyticsService } from './opening-drive-analytics.service';
import { EdgeActivationGateService, EdgeGateContext } from './edge-activation-gate.service';
import { DailyEdgeDiscoveryReportService } from './edge-discovery/daily-edge-discovery-report.service';
import { ExecutionEdgeGateService } from './edge-discovery/execution-edge-gate.service';
import { ExecutionEdgeGateResult } from './edge-discovery/edge-discovery.models';
import { LiveExecutionGateService } from './live-execution/live-execution-gate.service';
import { LiveExecutionGateSnapshot } from './live-execution/live-execution.models';
import { TradeLifecycleService } from './trade-lifecycle/trade-lifecycle.service';
import { LifecycleCoachSnapshot } from './trade-lifecycle/trade-lifecycle.models';
import { evaluatedSignals } from './signal-intelligence.math';
import { ExecutionQualitySynthesisService } from './execution-quality/execution-quality-synthesis.service';
import { LiveExecutionQualityIntel } from './execution-quality/execution-quality.models';
import { EntrySequencingSynthesisService } from './entry-sequencing/entry-sequencing-synthesis.service';
import { LiveEntrySequencingIntel } from './entry-sequencing/entry-sequencing.models';
import { ExecutionDecisionSynthesisService } from './live-decision/execution-decision-synthesis.service';
import { LiveExecutionDecisionSnapshot } from './live-decision/live-decision.models';
import { DecisionFeedbackSynthesisService } from './decision-feedback/decision-feedback-synthesis.service';
import { LiveDecisionFeedbackIntel } from './decision-feedback/decision-feedback.models';
import { MarketStateSynthesisService } from './market-state/market-state-synthesis.service';
import { LiveMarketStateIntel } from './market-state/market-state.models';
import { EntryOptimizationSynthesisService } from './adaptive-entry/entry-optimization-synthesis.service';
import { LiveAdaptiveEntryIntel } from './adaptive-entry/adaptive-entry.models';
import { AdaptiveCalibrationSynthesisService } from './adaptive-calibration/adaptive-calibration-synthesis.service';
import { LiveAdaptiveCalibrationIntel } from './adaptive-calibration/adaptive-calibration.models';

export interface ExecutionAdvisorySnapshot {
  symbol: string;
  matrix: SetupRegimeMatrixSnapshot;
  falseBreakout: FalseBreakoutSnapshot;
  openingDrive: OpeningDriveSnapshot;
  edgeGate: EdgeActivationGateSnapshot;
  discoveryGate: ExecutionEdgeGateResult | null;
  liveGate: LiveExecutionGateSnapshot;
  lifecycleCoach: LifecycleCoachSnapshot | null;
  executionQualityIntel: LiveExecutionQualityIntel | null;
  entrySequencingIntel: LiveEntrySequencingIntel | null;
  liveDecision: LiveExecutionDecisionSnapshot | null;
  decisionFeedbackIntel: LiveDecisionFeedbackIntel | null;
  marketStateIntel: LiveMarketStateIntel | null;
  adaptiveEntryIntel: LiveAdaptiveEntryIntel | null;
  adaptiveCalibrationIntel: LiveAdaptiveCalibrationIntel | null;
}

@Injectable({ providedIn: 'root' })
export class ExecutionAdvisoryAnalyticsService {
  private readonly matrixEngine = new SetupRegimeMatrixAnalyticsEngine();
  private readonly falseBreakoutEngine = new FalseBreakoutAnalyticsEngine();

  constructor(
    private store: SignalIntelligenceStore,
    private openingDrive: OpeningDriveAnalyticsService,
    private edgeGate: EdgeActivationGateService,
    private discoveryReport: DailyEdgeDiscoveryReportService,
    private discoveryGate: ExecutionEdgeGateService,
    private liveGateService: LiveExecutionGateService,
    private lifecycleService: TradeLifecycleService,
    private executionQualitySynthesis: ExecutionQualitySynthesisService,
    private entrySequencingSynthesis: EntrySequencingSynthesisService,
    private liveDecisionSynthesis: ExecutionDecisionSynthesisService,
    private decisionFeedbackSynthesis: DecisionFeedbackSynthesisService,
    private marketStateSynthesis: MarketStateSynthesisService,
    private adaptiveEntrySynthesis: EntryOptimizationSynthesisService,
    private adaptiveCalibrationSynthesis: AdaptiveCalibrationSynthesisService
  ) {}

  forSymbol(
    symbol: string,
    ctx: Partial<EdgeGateContext & OpeningDriveContext & {
      entryQuality?: string | null;
      premarketExtensionPct?: number | null;
      watchlist?: string[];
      signalAgeMinutes?: number | null;
      extended?: boolean;
    }> = {}
  ): ExecutionAdvisorySnapshot {
    const sym = symbol.toUpperCase();
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ symbol: sym, fromTs });

    const matrix = this.matrixEngine.analyzeSymbol(signals, sym);
    const falseBreakout = this.falseBreakoutEngine.analyzeSymbol(signals, sym);
    const historicalOpening = this.openingDrive.analyzeSymbol(signals, sym);
    const openingDrive = this.openingDrive.classifyLive(
      { symbol: sym, ...ctx },
      historicalOpening
    );
    const edgeGate = this.edgeGate.evaluate(signals, {
      symbol: sym,
      signalType: ctx.signalType,
      marketRegime: ctx.marketRegime,
      regimeAligned: ctx.regimeAligned
    }, matrix, falseBreakout, openingDrive);

    const report = this.discoveryReport.snapshot();
    const gateCtx: EdgeGateContext = {
      symbol: sym,
      signalType: ctx.signalType,
      marketRegime: ctx.marketRegime,
      regimeAligned: ctx.regimeAligned,
      rvol: ctx.rvol,
      sessionTimeMinutes: ctx.sessionTimeMinutes,
      vwapDistance: ctx.vwapDistance,
      trendAlignment: ctx.trendAlignment,
      entryQuality: ctx.entryQuality
    };

    const discoveryGate = report && report.discovery.totalEvaluated >= 10
      ? this.discoveryGate.evaluate(report, gateCtx)
      : null;

    const liveGate = this.liveGateService.evaluate({
      ctx: {
        symbol: sym,
        signalType: ctx.signalType,
        marketRegime: ctx.marketRegime,
        regimeAligned: ctx.regimeAligned,
        rvol: ctx.rvol,
        vwapDistance: ctx.vwapDistance,
        trendAlignment: ctx.trendAlignment,
        sessionTimeMinutes: ctx.sessionTimeMinutes,
        volatility: ctx.volatility,
        premarketExtensionPct: ctx.premarketExtensionPct,
        entryQuality: ctx.entryQuality
      },
      falseBreakout,
      openingDrive,
      matrix,
      discoveryGate,
      watchlist: ctx.watchlist,
      signalAgeMinutes: ctx.signalAgeMinutes,
      extended: ctx.extended
    });

    const lifecycleCoach = evaluatedSignals(signals).length > 0
      ? this.lifecycleService.coachSnapshot(sym)
      : null;

    const executionQualityIntel = ctx.signalType
      ? this.executionQualitySynthesis.liveIntel({
          symbol: sym,
          signalType: ctx.signalType,
          marketRegime: ctx.marketRegime ?? undefined,
          rvol: ctx.rvol ?? undefined,
          trendAlignment: ctx.trendAlignment ?? undefined,
          vwapDistance: ctx.vwapDistance ?? undefined,
          sessionTimeMinutes: ctx.sessionTimeMinutes ?? undefined,
          extended: ctx.extended,
          entryQuality: ctx.entryQuality ?? undefined
        })
      : null;

    const entrySequencingIntel = ctx.signalType
      ? this.entrySequencingSynthesis.liveIntel({
          symbol: sym,
          signalType: ctx.signalType,
          marketRegime: ctx.marketRegime ?? undefined,
          rvol: ctx.rvol ?? undefined,
          trendAlignment: ctx.trendAlignment ?? undefined,
          vwapDistance: ctx.vwapDistance ?? undefined,
          sessionTimeMinutes: ctx.sessionTimeMinutes ?? undefined,
          extended: ctx.extended,
          entryQuality: ctx.entryQuality ?? undefined
        })
      : null;

    const marketStateIntel = ctx.signalType
      ? this.marketStateSynthesis.liveIntel({
          symbol: sym,
          signalType: ctx.signalType,
          marketRegime: ctx.marketRegime ?? undefined,
          sessionTimeMinutes: ctx.sessionTimeMinutes ?? undefined,
          vwapDistance: ctx.vwapDistance ?? undefined,
          extended: ctx.extended,
          entryQuality: ctx.entryQuality ?? undefined,
          trendAlignment: ctx.trendAlignment ?? undefined,
          rvol: ctx.rvol ?? undefined,
          sequencingState: entrySequencingIntel?.currentState,
          fakeoutRisk: falseBreakout.trapRisk,
          sampleCount: evaluatedSignals(signals).length
        })
      : null;

    const adaptiveEntryIntel = ctx.signalType
      ? this.adaptiveEntrySynthesis.liveIntel({
          symbol: sym,
          signalType: ctx.signalType,
          marketRegime: ctx.marketRegime ?? undefined,
          sessionTimeMinutes: ctx.sessionTimeMinutes ?? undefined,
          vwapDistance: ctx.vwapDistance ?? undefined,
          extended: ctx.extended,
          entryQuality: ctx.entryQuality ?? undefined,
          trendAlignment: ctx.trendAlignment ?? undefined,
          rvol: ctx.rvol ?? undefined,
          sequencingState: entrySequencingIntel?.currentState,
          marketState: marketStateIntel?.currentState,
          narrativeTrajectory: marketStateIntel?.trajectory,
          sampleCount: evaluatedSignals(signals).length
        })
      : null;

    const adaptiveCalibrationIntel = ctx.signalType
      ? this.adaptiveCalibrationSynthesis.liveIntel({
          symbol: sym,
          signalType: ctx.signalType,
          marketRegime: ctx.marketRegime ?? undefined,
          trendAlignment: ctx.trendAlignment ?? undefined,
          narrativeTrajectory: marketStateIntel?.trajectory,
          narrativeQuality: marketStateIntel?.narrativeQuality,
          sampleCount: evaluatedSignals(signals).length
        })
      : null;

    const liveDecision = ctx.signalType
      ? this.liveDecisionSynthesis.liveDecision({
          symbol: sym,
          signalType: ctx.signalType,
          marketRegime: ctx.marketRegime ?? undefined,
          rvol: ctx.rvol ?? undefined,
          trendAlignment: ctx.trendAlignment ?? undefined,
          vwapDistance: ctx.vwapDistance ?? undefined,
          sessionTimeMinutes: ctx.sessionTimeMinutes ?? undefined,
          extended: ctx.extended,
          entryQuality: ctx.entryQuality ?? undefined,
          signalAgeMinutes: ctx.signalAgeMinutes ?? undefined,
          executionQualityIntel,
          entrySequencingIntel,
          liveGate,
          falseBreakoutTrap: falseBreakout.trapRisk,
          adaptiveEntryIntel,
          marketStateIntel,
          adaptiveCalibrationIntel
        })
      : null;

    const decisionFeedbackIntel = ctx.signalType
      ? this.decisionFeedbackSynthesis.liveIntel(sym, ctx.marketRegime ?? undefined)
      : null;

    return {
      symbol: sym, matrix, falseBreakout, openingDrive, edgeGate, discoveryGate, liveGate,
      lifecycleCoach, executionQualityIntel, entrySequencingIntel, liveDecision,
      decisionFeedbackIntel, marketStateIntel, adaptiveEntryIntel, adaptiveCalibrationIntel
    };
  }
}
