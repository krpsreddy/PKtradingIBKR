import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { catchError, EMPTY, forkJoin, interval, Observable, of, startWith, Subject, switchMap, takeUntil, tap, timer, debounceTime, distinctUntilChanged } from 'rxjs';
import { environment } from '../../environments/environment';
import { MetricsBarComponent } from '../metrics/metrics-bar.component';
import { TradingChartComponent } from '../charts/trading-chart.component';
import { TradingSidebarComponent } from '../sidebar/trading-sidebar.component';
import { SignalTableComponent } from '../signals/signal-table.component';
import { DebugPanelComponent } from '../debug/debug-panel.component';
import { CandleService } from '../services/candle.service';
import { IndicatorService } from '../services/indicator.service';
import { SignalService } from '../services/signal.service';
import { SystemStatusService } from '../services/system-status.service';
import { TradingSymbolService } from '../services/trading-symbol.service';
import { DebugService } from '../services/debug.service';
import { TradingSymbol } from '../models/trading-symbol.model';
import { SymbolService } from '../services/symbol.service';
import { MomentumService } from '../services/momentum.service';
import { MarketTrendService } from '../services/market-trend.service';
import { WatchlistStoreService } from '../services/watchlist-store.service';
import { ReplayService } from '../services/replay.service';
import { lastTradingDayIso } from '../utils/market-date.util';
import { ReplayPanelComponent } from '../replay/replay-panel.component';
import { FilterBarComponent } from '../components/filter-bar/filter-bar.component';
import { SignalTimelinePanelComponent, buildTimelineEntries } from '../components/signal-timeline-panel/signal-timeline-panel.component';
import { WorkflowStateService } from '../services/workflow-state.service';
import { DEFAULT_WORKFLOW_FILTERS, WorkflowFilters } from '../models/workflow-filters.model';
import { applyWorkflowFilters, filterWatchlist, sortActiveSignals } from '../utils/workflow-filter.util';
import { pickBestSetup, computeAttentionScore } from '../utils/attention-score.util';
import { buildSignalConditions, SignalConditions } from '../utils/signal-conditions.util';
import { SetupCandidate, ExecutionGuidance, SetupDeterioration, ChartExecutionLevel, TradeStructureOverlay } from '../models/execution.model';
import { TradeStructureOverlayService } from '../services/trade-structure-overlay.service';
import { ExecutionPlanService } from '../services/execution-plan/execution-plan.service';
import {
  ExecutionPlan,
  HistoricalExecutionSnapshot,
  ReplayDeterminismDrift
} from '../services/execution-plan/execution-plan.models';
import { HistoricalExecutionService } from '../services/historical-execution/historical-execution.service';
import { TraderOperatingModeService } from '../services/trader-operating-mode.service';
import { formatEntryZoneRange } from '../services/execution-plan/execution-plan-labels.util';
import { MarketHeartbeatService } from '../services/market-heartbeat.service';
import { detectSetupDeterioration } from '../utils/setup-deterioration.util';
import { ExecutionPanelComponent } from '../components/execution-panel/execution-panel.component';
import { QuickActionBarComponent } from '../components/quick-action-bar/quick-action-bar.component';
import { WhyNotPanelComponent } from '../components/why-not-panel/why-not-panel.component';
import { ExecutionQualityTimelineComponent } from '../components/execution-quality-timeline/execution-quality-timeline.component';
import { TradeJournalPanelComponent } from '../components/trade-journal-panel/trade-journal-panel.component';
import { ExecutionApiService, TradeJournalService } from '../services/refinement.service';
import { AnalyticsService } from '../services/analytics.service';
import { TradingEventBusService } from '../services/trading-event-bus.service';
import {
  BottomTabId,
  BehaviorInsight,
  DEFAULT_PLAYBOOKS,
  MarketMemory,
  Playbook,
  RankingExplanation,
  ReplayCoaching,
  SessionReview,
  StatisticalConfidence,
  TraderEdge,
  deriveRankingExplanations
} from '../models/analytics.model';
import { smartEmptyMessage } from '../utils/smart-empty.util';
import { CommandPaletteComponent, CommandAction } from '../components/command-palette/command-palette.component';
import { BottomTabPanelComponent, BottomTabDef } from '../components/bottom-tab-panel/bottom-tab-panel.component';
import { MyEdgePanelComponent } from '../components/my-edge-panel/my-edge-panel.component';
import { PlaybookBrowserComponent } from '../components/playbook-browser/playbook-browser.component';
import { SessionReviewComponent } from '../components/session-review/session-review.component';
import { TraderStateComponent } from '../components/trader-state/trader-state.component';
import { RankingExplainComponent } from '../components/ranking-explain/ranking-explain.component';
import { IntelligenceStreamComponent } from '../components/intelligence-stream/intelligence-stream.component';
import { PerformanceHeatmapComponent } from '../components/performance-heatmap/performance-heatmap.component';
import { MarketEnvironmentRibbonComponent } from '../components/market-environment-ribbon/market-environment-ribbon.component';
import { ExecutionStateBannerComponent } from '../components/execution-state-banner/execution-state-banner.component';
import { BestSetupCtaComponent } from '../components/best-setup-cta/best-setup-cta.component';
import { DisciplineBannerComponent } from '../components/discipline-banner/discipline-banner.component';
import { ExecutionStateService } from '../services/execution-state.service';
import { ExecutionState, ExecutionStateContext } from '../models/execution-state.model';
import { CognitionService } from '../services/cognition.service';
import { HistoricalService } from '../services/historical.service';
import { ProbabilisticService } from '../services/probabilistic.service';
import { ChartLiveStateService, ChartAnchorState } from '../services/chart-live-state.service';
import { NextActionPanelComponent } from '../components/next-action-panel/next-action-panel.component';
import { NextActionService, NextAction } from '../services/next-action.service';
import { TriggerLineOverlayService, TriggerLine } from '../services/trigger-line-overlay.service';
import { ChartTimeframe, filterCandlesByTimeframe, prevSessionClose as calcPrevClose } from '../utils/chart-range.util';
import { LivePriceFocusService, FocusPulseMode } from '../services/live-price-focus.service';
import { WorkspaceAdaptiveLayoutService, WorkspaceLayoutSnapshot } from '../services/workspace-adaptive-layout.service';
import { DashboardOrchestratorService } from '../services/dashboard/dashboard-orchestrator.service';
import { DashboardStateStoreService } from '../services/dashboard/dashboard-state-store.service';
import { SymbolEnrichmentQueueService } from '../services/dashboard/symbol-enrichment-queue.service';
import { NetworkDiagnosticsPanelComponent } from '../components/network-diagnostics-panel/network-diagnostics-panel.component';
import { SituationalIntensityEngine, IntensitySnapshot } from '../services/situational-intensity.engine';
import { LiquidityTensionEngine, TensionSnapshot } from '../services/liquidity-tension.engine';
import { MarketBreathingEngine, BreathingSnapshot } from '../services/market-breathing.engine';
import { AttentionGravityService, GravitySnapshot } from '../services/attention-gravity.service';
import { MicroDepthEngine, DepthSnapshot } from '../services/micro-depth.engine';
import { TemporalDecayFieldEngine, TemporalDecaySnapshot } from '../services/temporal-decay-field.engine';
import { ConvictionPressureEngine, PressureSnapshot } from '../services/conviction-pressure.engine';
import { VisualLiquidityModel, LiquiditySnapshot } from '../services/visual-liquidity.model';
import { ExecutionPriorityMatrixService, PrioritySnapshot } from '../services/execution-priority-matrix.service';
import { selectChartCognitionPills, ChartCognitionPill } from '../utils/chart-cognition-pills.util';
import { ActiveTradeModeService } from '../services/active-trade-mode.service';
import { clampBottomCompositeDarkness, clampCompositeDarkness } from '../utils/chart-atmosphere-recovery.util';
import { CognitionSnapshot, EMPTY_COGNITION, ReplayNarrative } from '../models/cognition.model';
import { HistoricalInsight } from '../models/historical.model';
import { EMPTY_PROBABILISTIC_SNAPSHOT, ProbabilisticExecutionSnapshot, ReplayProbabilistic } from '../models/probabilistic.model';
import { focusSymbolSwitcher } from '../components/global-symbol-switcher/global-symbol-switcher.component';
import { ExecutionSnapshot, EmergingSetup, TradeJournalEntry, ExecutionQualityPoint } from '../models/refinement.model';
import { buildExecutionQualityTimeline } from '../utils/refinement.util';
import { Candle } from '../models/candle.model';
import { IndicatorSnapshot } from '../models/indicator.model';
import { TradingSignal } from '../models/signal.model';
import { ReplayHistory, ReplaySignalEvent, ReplaySpeed } from '../models/replay.model';
import { DebugPanel, SystemStatus } from '../models/system-status.model';
import { SignalIntelligencePanelComponent } from '../components/signal-intelligence-panel/signal-intelligence-panel.component';
import { SignalIntelligenceEngine } from '../services/signal-intelligence/signal-intelligence.engine';
import { SignalEdgeIntelligenceService } from '../services/signal-intelligence/signal-edge-intelligence.service';
import {
  ExecutionAdvisoryAnalyticsService,
  ExecutionAdvisorySnapshot
} from '../services/signal-intelligence/execution-advisory-analytics.service';
import { SignalEdgeIntelligenceSnapshot } from '../models/signal-intelligence.model';
import { WorkspaceModeService, ReviewTabId } from '../services/workspace-mode.service';
import { WorkspaceModeSwitchComponent } from '../components/workspace-mode-switch/workspace-mode-switch.component';
import { ReviewWorkspaceComponent } from '../review/review-workspace.component';
import { AiExecutionIntelligenceService } from '../ai/services/ai-execution-intelligence.service';
import { AiExecutionResponse } from '../ai/models/ai.models';
import { formatAiCompactLine } from '../ai/utils/ai-compact-line.util';
import {
  ActiveSignal,
  HotMomentumItem,
  OpeningMomentumItem,
  MarketTrend,
  SymbolCacheEntry,
  SymbolSubscribeResponse,
  TrendShade
} from '../models/workspace.model';
import { ReplayUxSynthesisService } from '../services/chart/replay-viewport/replay-ux-synthesis.service';
import { ReplayViewportState } from '../services/chart/replay-viewport/replay-viewport.models';
import { ReplayProfessionalReviewService } from '../services/replay-decision-visualization/replay-professional-review.service';
import { ReplayContextMode } from '../services/replay-decision-visualization/replay-decision-visualization.models';
import { ReplayWorkstationSynthesisService } from '../services/replay-workstation/replay-workstation-synthesis.service';
import {
  ReplayDisplayMode,
  ReplaySessionCatalogEntry,
  ReplaySignalJumpKind,
  ReplayStartMode,
  ReplayWorkstationMode,
  ReplayWorkstationState
} from '../services/replay-workstation/replay-workstation.models';
import { SignalExplorerPanelComponent } from '../components/signal-explorer-panel/signal-explorer-panel.component';
import { SignalExplorerSynthesisService } from '../services/signal-explorer/signal-explorer-synthesis.service';
import { ReplayLaunchIntentService } from '../services/signal-centric-replay/replay-launch-intent.service';
import { SignalJumpContextEngine } from '../services/signal-centric-replay/signal-jump-context.engine';
import { IntelligenceOffloadService } from '../services/intelligence-offload/intelligence-offload.service';
import { ReplayIntelligenceCacheService } from '../services/intelligence-offload/replay-intelligence-cache.service';
import { AutonomousRegimeScannerService } from '../services/autonomous-regime-scanner/autonomous-regime-scanner.service';
import { ScannerOpportunityCard, ScannerSnapshot } from '../services/autonomous-regime-scanner/autonomous-regime-scanner.models';
import { buildCompactSuggestion } from '../services/autonomous-regime-scanner/autonomous-suggestions.engine';
import { RealTimeExecutionService } from '../services/real-time-execution/real-time-execution.service';
import { AutoExecutionSwitchComponent } from '../components/auto-execution-switch/auto-execution-switch.component';
import { PaperExecutionResearchHookService } from '../services/paper-execution-research-hook.service';
import { ExecutionFrameworkMode167 } from '../services/real-time-execution/real-time-execution.models';
import { EnrichedOpportunity } from '../services/execution-intelligence/enriched-opportunity.model';
import { SignalReplayLaunchPlan } from '../services/signal-explorer/signal-explorer.models';
import { SignalNavKind } from '../services/signal-explorer/signal-navigation.engine';
import { ReplayWorkstationUxSynthesisService } from '../services/replay-workstation/replay-workstation-ux-synthesis.service';
import {
  ReplayActionFeedback,
  ReplayBreadcrumb,
  ReplayDebugInfo,
  ReplayPanelTab,
  ReplayUxStatus
} from '../services/replay-workstation/replay-ux.models';

function safeApi<T>(obs: Observable<T>, fallback: T): Observable<T> {
  return obs.pipe(catchError(() => of(fallback)));
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MetricsBarComponent,
    TradingChartComponent,
    TradingSidebarComponent,
    DebugPanelComponent,
    ReplayPanelComponent,
    FilterBarComponent,
    ExecutionPanelComponent,
    QuickActionBarComponent,
    ExecutionQualityTimelineComponent,
    CommandPaletteComponent,
    MarketEnvironmentRibbonComponent,
    ExecutionStateBannerComponent,
    BestSetupCtaComponent,
    NextActionPanelComponent,
    WorkspaceModeSwitchComponent,
    ReviewWorkspaceComponent,
    SignalExplorerPanelComponent,
    NetworkDiagnosticsPanelComponent,
    AutoExecutionSwitchComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(TradingSidebarComponent) sidebar?: TradingSidebarComponent;
  @ViewChild(TradingChartComponent) tradingChart?: TradingChartComponent;

  selectedSymbol = 'NVDA';
  candles: Candle[] = [];
  indicators: IndicatorSnapshot | null = null;
  signals: TradingSignal[] = [];
  activeSignals: ActiveSignal[] = [];
  hotMomentum: HotMomentumItem[] = [];
  continuationSetups: HotMomentumItem[] = [];
  openingMomentum: OpeningMomentumItem[] = [];
  failedMomentum: HotMomentumItem[] = [];
  marketTrend: MarketTrend | null = null;
  watchlist: TradingSymbol[] = [];
  watchlistSymbolNames: string[] = [];
  private apiSymbols: TradingSymbol[] = [];
  status: SystemStatus | null = null;
  debug: DebugPanel | null = null;
  livePrice: number | null = null;
  trendLabel = '—';
  trendShade: TrendShade = 'neutral';

  chartLoading = false;
  chartReady = true;
  loadingMessage = 'Loading historical data...';
  loadingSymbols: string[] = [];
  symbolErrors: Record<string, string> = {};
  searchLoading = false;
  sidebarCollapsed = false;
  historyCollapsed = false;
  mobileSidebarOpen = false;
  workflowFilters: WorkflowFilters = { ...DEFAULT_WORKFLOW_FILTERS };
  filteredActiveSignals: ActiveSignal[] = [];
  autonomousCards: Record<string, ScannerOpportunityCard> = {};
  scannerSnapshot: ScannerSnapshot | null = null;
  edgeLabInitialTab: import('../components/global-edge-lab/global-edge-lab.component').EdgeLabTab | null = null;
  edgeLabFocusSymbol: string | null = null;
  rtExecutionMode: ExecutionFrameworkMode167 = 'CONFIRMED';
  topEnrichedOpportunity: EnrichedOpportunity | null = null;
  filteredWatchlist: TradingSymbol[] = [];
  bestSetup: SetupCandidate = { symbol: '—', signalType: 'WATCH' };
  bestSetupWeak = false;
  executionSource: SetupCandidate | null = null;
  executionGuidance: ExecutionGuidance | null = null;
  executionPlan: ExecutionPlan | null = null;
  historicalExecutionSnapshot: HistoricalExecutionSnapshot | null = null;
  replayPlanDrift: ReplayDeterminismDrift[] = [];
  setupDeterioration: SetupDeterioration | null = null;
  chartExecutionLevels: ChartExecutionLevel[] = [];
  executionSnapshot: ExecutionSnapshot | null = null;
  tradeStructureOverlay: TradeStructureOverlay | null = null;
  tradeRrLabel: string | null = null;
  sessionPrevClose: number | null = null;
  emphasizeLiveCandle = false;
  liveCandlePulse = false;
  heartbeatPulses: string[] = [];
  heartbeatEmotion: { label: string; description: string } | null = null;
  executionState: ExecutionState = 'WATCHING';
  bestSetupCtaDismissed = false;
  chartTimeframe: ChartTimeframe = 'TODAY';
  displayCandles: Candle[] = [];
  triggerLine: TriggerLine | null = null;
  nextAction: NextAction | null = null;
  chartCognitionPills: ChartCognitionPill[] = [];
  calmMode = false;
  urgencyEscalation = false;
  intensity: IntensitySnapshot = {
    mode: 'CALM',
    saturation: 0.5,
    pulseAllowed: false,
    sidebarOpacity: 0.5,
    gridHorz: 0.22,
    gridVert: 0.16,
    liveEnergy: 0.4,
    overlayEnergy: 0.3,
    calmMode: true,
    urgencyActive: false,
    chartContrast: 0.96,
    railDim: 0.62,
    labelSharpness: 0.6,
    failurePressure: false,
    maDepth: 0.38,
    historyFade: 0.38,
    candleEmphasis: 0.35
  };
  staleTrigger = false;
  breathing: BreathingSnapshot = {
    ambientDrift: 1, environmentalPressure: 0, workspaceBreathing: 1,
    holdBreath: 0, focusCompression: 1, luminanceReduction: 0
  };
  temporal: TemporalDecaySnapshot = {
    triggerOpacity: 0.55, rowOpacity: 1, momentumOpacity: 0.88, setupOpacity: 0.92, globalForget: 1
  };
  pressure: PressureSnapshot = {
    forwardPressure: 0, contrastCompression: 1, brightnessSteer: 1, corridorNarrow: 1
  };
  liquidity: LiquiditySnapshot = {
    liquidityDensity: 0.35, expansionProbability: 0.3, liveCandleBoost: 0.55,
    volumeOpacity: 0.28, corridorSharpness: 0.45, triggerClarity: 0.4
  };
  priority: PrioritySnapshot = {
    dominantPath: 'none', metricOrder: ['entry', 'stop', 'exit', 'rr'],
    spatialPull: 0.55, railPrecision: 0.72, stillness: true
  };
  gravity: GravitySnapshot = {
    weights: { exit: 0.42, stop: 0.42, entry: 0.42, trigger: 0.42, target: 0.42, rr: 0.42, rvol: 0.42, fail: 0.42 },
    railContrast: 0.72,
    chartSharpness: 1,
    sidebarLift: 0,
    corridorBias: 'neutral',
    silenceActive: false,
    targetFade: 1,
    triggerSoftness: 1,
    liveCandleDominance: 0.55,
    labelWeights: {}
  };
  depth: DepthSnapshot = { liveCandle: 0.92, overlays: 0.48, labels: 0.52, movingAverages: 0.38, history: 0.38, grid: 0.72 };
  tension: TensionSnapshot = {
    score: 0,
    volumePulse: 0.18,
    triggerClarity: 0.3,
    liveBoost: 0,
    labelSharpness: 0.45,
    chartTightness: 1,
    ambientBreathing: 1,
    failureBias: 0,
    volumeContrast: 0.2
  };
  overlayIntelContext: import('../services/execution-overlay-intelligence.service').OverlayIntelContext = {
    adaptiveExit: null,
    deterioration: null,
    failurePct: null,
    continuationRising: false,
    exitNow: false
  };
  focusPulse: FocusPulseMode = 'neutral';
  adaptiveLayout: WorkspaceLayoutSnapshot = {
    chartHeight: 'min(42vh, 460px)',
    sidebarCompact: false,
    hideBottomIntel: false,
    fillMode: false,
    chartDominant: false,
    executionOverlay: false
  };
  emergingSetups: EmergingSetup[] = [];
  journalEntries: TradeJournalEntry[] = [];
  qualityTimeline: ExecutionQualityPoint[] = [];
  focusMode = false;
  miniMode = false;
  bottomTab: BottomTabId | null = null;
  bottomExpanded = false;
  sidebarWidth = 300;
  recentSymbols: string[] = [];
  commandPaletteOpen = false;
  traderEdge: TraderEdge | null = null;
  behaviorInsights: BehaviorInsight[] = [];
  replayCoaching: ReplayCoaching | null = null;
  sessionReview: SessionReview | null = null;
  sessionReviewLoading = true;
  playbooks: Playbook[] = DEFAULT_PLAYBOOKS;
  marketMemory: MarketMemory | null = null;
  executionConfidence: StatisticalConfidence[] = [];
  rankingNotes: RankingExplanation[] = [];
  cognition: CognitionSnapshot = EMPTY_COGNITION;
  historicalInsight: HistoricalInsight | null = null;
  probabilisticExecution: ProbabilisticExecutionSnapshot = EMPTY_PROBABILISTIC_SNAPSHOT;
  replayProbabilistic: ReplayProbabilistic | null = null;
  chartAnchorState: ChartAnchorState = 'LIVE_LOCKED';
  activeTradeMode = false;
  replayNarrative: ReplayNarrative | null = null;
  regimeWinRates: Record<string, number> = {};
  signalAnalytics: SignalEdgeIntelligenceSnapshot | null = null;
  executionAdvisory: ExecutionAdvisorySnapshot | null = null;
  bestSetupWinRate: number | null = null;
  emptySignals = { title: '', detail: '' };
  signalConditions: SignalConditions | null = null;
  selectedSignalType = '';
  reasonPanelCollapsed = false;
  reviewTab: ReviewTabId = 'intelligence';
  reviewAnalyticsLoaded = false;
  aiExecution: AiExecutionResponse | null = null;

  chartMode: 'LIVE' | 'REPLAY' = 'LIVE';
  replayHistory: ReplayHistory | null = null;
  replayIndex = -1;
  replayPlaying = false;
  replaySpeed: ReplaySpeed = 1;
  replaySpeeds: Array<1 | 2 | 5> = [1, 2, 5];
  replayLoading = false;
  replayError: string | null = null;
  replayDate = lastTradingDayIso();
  selectedReplayEvent: ReplaySignalEvent | null = null;
  visibleReplayTimeline: ReplaySignalEvent[] = [];
  visibleReplayScores: ReplayHistory['scoreHistory'] = [];
  replayViewportState: ReplayViewportState | null = null;
  replayWorkstationState: ReplayWorkstationState | null = null;
  replayReviewMode = false;
  replayChartCursor = -1;
  replayDecisionRows: import('../services/replay-decision-visualization/replay-decision-visualization.models').ReplayDecisionTimelineRow[] = [];
  replayReviewSummary: import('../services/replay-decision-visualization/replay-decision-visualization.models').ReplaySessionReviewSummary | null = null;
  replayStudyMode: import('../services/replay-decision-visualization/replay-decision-visualization.models').ReplayStudyMode = 'PLAYBACK';
  replayNarrativeBands: import('../services/replay-decision-visualization/replay-decision-visualization.models').ReplayNarrativeBand[] = [];
  replaySessionStartIndex = 0;
  signalExplorerDockOpen = false;
  replayUxStatus: ReplayUxStatus = 'READY';
  replayActionFeedback: ReplayActionFeedback | null = null;
  replayBreadcrumb: ReplayBreadcrumb | null = null;
  replayDebugInfo: ReplayDebugInfo | null = null;
  replayPanelTab: ReplayPanelTab = 'timeline';
  replayBottomExpanded = true;
  replayFocusBarIndex: number | null = null;
  pendingReplayAction: string | null = null;

  private liveCandles: Candle[] = [];
  private liveSignals: TradingSignal[] = [];
  private liveIndicators: IndicatorSnapshot | null = null;

  private destroy$ = new Subject<void>();
  private knownActiveKeys = new Set<string>();
  private alertedHighConfKeys = new Set<string>();
  private audioCtx?: AudioContext;
  private symbolCache = new Map<string, SymbolCacheEntry>();
  private loadedSymbols = new Set<string>();

  constructor(
    private candleService: CandleService,
    private indicatorService: IndicatorService,
    private signalService: SignalService,
    private systemStatusService: SystemStatusService,
    private tradingSymbolService: TradingSymbolService,
    private debugService: DebugService,
    private symbolService: SymbolService,
    private momentumService: MomentumService,
    private marketTrendService: MarketTrendService,
    private watchlistStore: WatchlistStoreService,
    private replayService: ReplayService,
    private workflowState: WorkflowStateService,
    private executionApi: ExecutionApiService,
    private tradeJournalService: TradeJournalService,
    private analyticsService: AnalyticsService,
    private cognitionService: CognitionService,
    private historicalService: HistoricalService,
    private probabilisticService: ProbabilisticService,
    private chartLiveState: ChartLiveStateService,
    private activeTradeModeService: ActiveTradeModeService,
    private tradeOverlayService: TradeStructureOverlayService,
    private executionPlanService: ExecutionPlanService,
    private historicalExecution: HistoricalExecutionService,
    public traderOperatingMode: TraderOperatingModeService,
    private marketHeartbeatService: MarketHeartbeatService,
    private executionStateService: ExecutionStateService,
    private nextActionService: NextActionService,
    private triggerLineService: TriggerLineOverlayService,
    private livePriceFocus: LivePriceFocusService,
    private workspaceLayout: WorkspaceAdaptiveLayoutService,
    private intensityEngine: SituationalIntensityEngine,
    private liquidityTension: LiquidityTensionEngine,
    private marketBreathing: MarketBreathingEngine,
    private attentionGravity: AttentionGravityService,
    private microDepth: MicroDepthEngine,
    private temporalDecay: TemporalDecayFieldEngine,
    private convictionPressure: ConvictionPressureEngine,
    private visualLiquidity: VisualLiquidityModel,
    private priorityMatrix: ExecutionPriorityMatrixService,
    private eventBus: TradingEventBusService,
    private signalIntelligence: SignalIntelligenceEngine,
    private signalEdgeIntelligence: SignalEdgeIntelligenceService,
    private executionAdvisoryService: ExecutionAdvisoryAnalyticsService,
    readonly workspaceMode: WorkspaceModeService,
    private aiExecutionIntelligence: AiExecutionIntelligenceService,
    private replayViewportUx: ReplayUxSynthesisService,
    private replayWorkstation: ReplayWorkstationSynthesisService,
    private replayReview: ReplayProfessionalReviewService,
    private router: Router,
    private signalExplorer: SignalExplorerSynthesisService,
    private replayLaunchIntent: ReplayLaunchIntentService,
    private signalJump: SignalJumpContextEngine,
    private replayWorkstationUx: ReplayWorkstationUxSynthesisService,
    private intelligenceOffload: IntelligenceOffloadService,
    private replayIntelCache: ReplayIntelligenceCacheService,
    private autonomousScanner: AutonomousRegimeScannerService,
    private rtExecution: RealTimeExecutionService,
    private dashboardOrchestrator: DashboardOrchestratorService,
    private dashboardStore: DashboardStateStoreService,
    private enrichQueue: SymbolEnrichmentQueueService,
    private cdr: ChangeDetectorRef,
    private paperResearchHook: PaperExecutionResearchHookService
  ) {}

  ngOnInit(): void {
    this.watchlistStore.migrateLegacyKeys();
    const layout = this.workflowState.loadLayout();
    this.sidebarCollapsed = layout.sidebarCollapsed ?? false;
    this.historyCollapsed = layout.historyCollapsed ?? false;
    this.chartTimeframe = this.chartLiveState.chartTimeframe();
    if (this.chartTimeframe === 'REPLAY') {
      this.chartMode = 'REPLAY';
    } else {
      this.chartMode = layout.chartMode ?? 'LIVE';
    }
    this.focusMode = this.workflowState.loadFocusMode();
    this.miniMode = this.workflowState.loadMiniMode();
    if (this.workflowState.loadActiveTradeMode()) {
      this.activeTradeModeService.enable();
      this.focusMode = true;
    }
    this.recentSymbols = this.workflowState.loadRecentSymbols();
    this.sidebarWidth = this.workflowState.loadSidebarWidth();
    this.bottomTab = this.workflowState.loadBottomTab();
    this.bottomExpanded = this.workflowState.loadUserExpandedBottom();
    this.workflowFilters = this.workflowState.loadFilters();
    this.selectedSymbol = (this.watchlistStore.getSelectedSymbol() || 'NVDA').toUpperCase();
    this.bestSetupCtaDismissed = sessionStorage.getItem('bestSetupCtaDismissed') === '1';
    this.migrateLegacyCustomSymbols();
    if (this.workspaceMode.isReview()) {
      this.ensureReviewAnalytics();
    }
    this.loadCognition();
    this.dashboardStore.setSelectedSymbol(this.selectedSymbol);
    this.dashboardStore.setChartMode(this.chartMode);
    this.dashboardStore.setMiniMode(this.miniMode);
    this.dashboardOrchestrator.start();
    this.paperResearchHook.connect();
    this.rtExecution.enriched$.pipe(takeUntil(this.destroy$)).subscribe(items => {
      this.topEnrichedOpportunity = this.attachPlansToEnriched(items)[0] ?? null;
      this.cdr.markForCheck();
    });

    this.signalExplorer.registerLaunchHandler(plan => this.jumpToHistoricalSignal(plan));

    if (this.replayLaunchIntent.hasPending()) {
      this.prepareReplayLaunch(this.replayLaunchIntent.peek()!);
    } else {
      this.activateSymbol(this.selectedSymbol, false);
      this.replayService.setMode(this.chartMode);
      if (this.chartMode === 'REPLAY') {
        this.replayDate = lastTradingDayIso();
        this.loadHistoricalReplay();
      }
    }

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      if (!this.router.url.includes('/dashboard')) return;
      const plan = this.replayLaunchIntent.consume();
      if (plan) {
        this.prepareReplayLaunch(plan);
        void this.launchReplayFromPlan(plan);
      }
    });

    this.replayWorkstationUx.registerSnapHandler((barIndex) => {
      this.replayFocusBarIndex = barIndex;
      this.tradingChart?.snapReplayViewport(barIndex);
      this.refreshReplayUxDebug();
      setTimeout(() => {
        this.replayFocusBarIndex = null;
        this.cdr.markForCheck();
      }, 700);
    });

    this.replayWorkstationUx.state$.pipe(takeUntil(this.destroy$)).subscribe(state => {
      this.replayUxStatus = state.status;
      this.replayActionFeedback = state.feedback;
      this.replayDebugInfo = state.debug;
      this.replayPanelTab = state.layout.activeTab;
      this.replayBottomExpanded = state.layout.bottomExpanded;
      this.cdr.markForCheck();
    });

    this.replayService.history$.pipe(takeUntil(this.destroy$)).subscribe(h => {
      this.replayHistory = h;
      if (h?.replayDate) {
        this.replayViewportUx.onReplaySessionStart(this.selectedSymbol, h.replayDate, this.replayIndex);
        if (this.intelligenceOffload.isEnabled()) {
          this.replayIntelCache.preload(this.selectedSymbol, h.replayDate).subscribe(t => {
            this.replayIntelCache.setTimeline(this.selectedSymbol, h.replayDate, t);
            this.cdr.markForCheck();
          });
        }
      }
      this.refreshReplayView();
    });
    this.replayViewportUx.state$.pipe(takeUntil(this.destroy$)).subscribe(state => {
      this.replayViewportState = state;
      this.refreshReplayUxDebug();
      this.cdr.markForCheck();
    });
    this.replayWorkstation.state$.pipe(takeUntil(this.destroy$)).subscribe(state => {
    this.replayWorkstationState = state;
    this.replayReviewMode = state.displayMode === 'REVIEW';
    this.replayStudyMode = this.replayReview.toStudyMode(state.displayMode, this.replayReviewMode);
    this.cdr.markForCheck();
    });
    this.replayService.currentIndex$.pipe(
      debounceTime(32),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(i => {
      this.replayIndex = i;
      this.replayWorkstation.persistCursor(i);
      this.refreshReplayView();
      this.refreshReplayUxBreadcrumb();
      this.loadReplayNarrative(i);
    });
    this.replayService.playing$.pipe(takeUntil(this.destroy$)).subscribe(p => {
      this.replayPlaying = p;
    });
    this.replayService.speed$.pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.replaySpeed = s;
    });
    this.replayService.selectedEvent$.pipe(takeUntil(this.destroy$)).subscribe(e => {
      this.selectedReplayEvent = e;
    });
    this.chartLiveState.anchorState$.pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.chartAnchorState = s;
      this.cdr.markForCheck();
    });
    this.activeTradeModeService.active$.pipe(takeUntil(this.destroy$)).subscribe(a => {
      this.activeTradeMode = a;
      this.applyTradeOverlay(this.executionSource);
      this.cdr.markForCheck();
    });
    if (this.chartMode === 'REPLAY') {
      this.chartLiveState.setReplayMode();
    }
    this.refreshAdaptiveLayout();

    this.dashboardOrchestrator.heartbeat$.pipe(takeUntil(this.destroy$)).subscribe(hb => {
      if (!hb) return;
      this.heartbeatPulses = hb.pulses ?? [];
      this.heartbeatEmotion = hb.marketEmotion ?? null;
      this.cdr.markForCheck();
    });

    this.executionStateService.executionState$.pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.executionState = s.state;
      this.refreshSignalIntelligence();
      this.cdr.markForCheck();
    });

    this.signalEdgeIntelligence.edge$.pipe(takeUntil(this.destroy$)).subscribe(a => {
      if (this.workspaceMode.isReview()) {
        this.signalAnalytics = a;
        this.cdr.markForCheck();
      }
    });
    this.workspaceMode.mode$.pipe(takeUntil(this.destroy$)).subscribe(mode => {
      if (mode === 'review') {
        const tab = this.workspaceMode.consumeReviewTab();
        if (tab) this.reviewTab = tab;
        this.ensureReviewAnalytics();
        this.signalAnalytics = this.signalEdgeIntelligence.snapshot();
      } else {
        this.bottomExpanded = false;
      }
      this.refreshAdaptiveLayout();
      this.cdr.markForCheck();
    });
    this.chartLiveState.chartTimeframe$.pipe(takeUntil(this.destroy$)).subscribe(tf => {
      this.chartTimeframe = tf;
      this.applyDisplayCandles();
      this.cdr.markForCheck();
    });

    this.dashboardOrchestrator.lightPoll$.pipe(takeUntil(this.destroy$)).subscribe(data => {
      this.apiSymbols = data.symbols ?? [];
      this.watchlist = data.symbols ?? [];
      this.syncWatchlistSymbolNames();
      this.status = data.status;
      this.debug = data.debug;
      this.hotMomentum = data.hot;
      this.continuationSetups = data.continuation;
      this.openingMomentum = data.opening;
      this.failedMomentum = data.failed;
      this.marketTrend = data.market;
      this.emergingSetups = data.emerging ?? [];
      this.eventBus.patchMarketTrend(this.marketTrend);
      this.updateLivePrice();
      this.syncBottomPanelState();
      this.refreshWorkflowViews();
      this.cdr.markForCheck();
    });

    this.dashboardOrchestrator.heavyPoll$.pipe(takeUntil(this.destroy$)).subscribe(data => {
      this.journalEntries = data.journal ?? [];
      this.traderEdge = data.edge;
      this.behaviorInsights = data.behavior ?? [];
      this.marketMemory = data.memory;
      this.rankingNotes = deriveRankingExplanations(
        this.marketMemory,
        this.behaviorInsights,
        this.marketTrend?.regime ?? null
      );
      this.eventBus.patchAnalytics(this.traderEdge, this.behaviorInsights, this.marketMemory);
      this.loadWinRatesForSignals();
      this.refreshConfidence();
      this.cdr.markForCheck();
    });

    this.dashboardOrchestrator.activeSymbol$.pipe(takeUntil(this.destroy$)).subscribe({
      next: data => { this.applySymbolData(data); this.cdr.markForCheck(); },
      error: err => console.error('Dashboard refresh failed', err)
    });

    this.dashboardStore.activeSignals$.pipe(takeUntil(this.destroy$)).subscribe(active => {
      this.updateActiveSignals(active);
      this.eventBus.patchActiveSignals(active);
      this.refreshWorkflowViews();
      this.cdr.markForCheck();
    });

    this.dashboardStore.scanner$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.applyScannerFromStoreLight();
      this.cdr.markForCheck();
    });

    this.dashboardOrchestrator.planRefresh$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.applyScannerPlansForFocus();
      this.cdr.markForCheck();
    });

    this.aiExecutionIntelligence.execution$.pipe(takeUntil(this.destroy$)).subscribe(exec => {
      if (exec) {
        this.aiExecution = exec;
        this.cdr.markForCheck();
      }
    });
  }

  ngAfterViewInit(): void {
    const plan = this.consumeReplayLaunchPlan();
    if (plan) {
      void this.launchReplayFromPlan(plan);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.dashboardOrchestrator.stop();
    this.paperResearchHook.disconnect();
    this.audioCtx?.close();
  }

  toggleFocusMode(): void {
    if (this.activeTradeMode) return;
    this.focusMode = !this.focusMode;
    this.workflowState.saveFocusMode(this.focusMode);
    if (this.focusMode) this.bottomExpanded = false;
    this.refreshAdaptiveLayout();
    this.cdr.markForCheck();
  }

  toggleMiniMode(): void {
    this.miniMode = !this.miniMode;
    this.workflowState.saveMiniMode(this.miniMode);
    if (this.miniMode) {
      this.bottomExpanded = false;
      this.focusMode = false;
    }
    this.cdr.markForCheck();
  }

  get headerIndicators(): IndicatorSnapshot | null {
    return this.liveIndicators ?? this.indicators;
  }

  get bottomTabs(): BottomTabDef[] {
    return [
      { id: 'history', label: 'Execution History', count: this.signals.length },
      { id: 'journal', label: 'Trade Journal', count: this.journalEntries.length },
      { id: 'session', label: 'Regime Session Review' },
      { id: 'timeline', label: 'Execution Timeline', count: this.timelineEntries().length, hidden: this.chartMode === 'LIVE' && this.timelineEntries().length === 0 },
      { id: 'edge', label: 'Execution Edge' },
      { id: 'intelligence', label: 'Execution Intelligence', count: this.signalAnalytics?.evaluatedSignals ?? this.signalAnalytics?.totalSignals },
      { id: 'playbooks', label: 'Autonomous Playbooks' },
      { id: 'notes', label: 'Coaching' },
      { id: 'replay', label: 'Replay', hidden: this.chartMode !== 'REPLAY' }
    ];
  }

  get commandActions(): CommandAction[] {
    return [
      { id: 'switch', label: `Switch symbol (current: ${this.selectedSymbol})`, group: 'Navigation' },
      { id: 'best', label: 'Jump to best setup', group: 'Navigation' },
      { id: 'replay', label: 'Open replay mode', group: 'Mode' },
      { id: 'focus', label: this.focusMode ? 'Disable focus mode' : 'Enable focus mode', group: 'Mode' },
      { id: 'mini', label: this.miniMode ? 'Disable mini mode' : 'Enable mini mode', group: 'Mode' },
      { id: 'journal', label: 'Open trade journal (Review)', group: 'Review' },
      { id: 'history', label: 'Open execution history (Review)', group: 'Review' },
      { id: 'edge', label: 'Open execution edge (Review)', group: 'Review' },
      { id: 'intelligence', label: 'Open execution intelligence (Review)', group: 'Review' },
      { id: 'edge-lab', label: 'Open autonomous edge lab (Review)', group: 'Review' },
      { id: 'symbol-dna', label: 'Open autonomous symbol profile (Review)', group: 'Review' },
      { id: 'symbol-edge', label: 'Open autonomous symbol profile (Review)', group: 'Review' },
      { id: 'edge-discovery', label: 'Open autonomous edge lab (Review)', group: 'Review' },
      { id: 'autonomous-discovery', label: 'Open strategy discovery lab (EXPANSION clusters)', group: 'Review' },
      { id: 'playbook-lab', label: 'Open strategy research lab (Review)', group: 'Review' },
      { id: 'trade-timeline', label: 'Open execution timeline (Review)', group: 'Review' },
      { id: 'edge-refinement', label: 'Open regime refinement (Review)', group: 'Review' },
      { id: 'signal-explorer', label: 'Open opportunity explorer (Review)', group: 'Review' },
      { id: 'session', label: 'Open regime session review (Review)', group: 'Review' },
      { id: 'playbooks', label: 'Open autonomous playbooks (Review)', group: 'Review' },
      { id: 'review', label: 'Switch to Review workspace', group: 'Review' }
    ];
  }

  openCommandPalette(): void {
    this.commandPaletteOpen = true;
    this.cdr.markForCheck();
  }

  onCommand(id: string): void {
    if (id === 'switch') focusSymbolSwitcher();
    else if (id === 'best' && this.bestSetup.symbol !== '—') this.selectSymbol(this.bestSetup.symbol);
    else if (id === 'replay') this.setChartMode('REPLAY');
    else if (id === 'focus') this.toggleFocusMode();
    else if (id === 'mini') this.toggleMiniMode();
    else if (id === 'review') this.openReviewWorkspace('intelligence');
    else if (id === 'journal') this.openReviewWorkspace('journal');
    else if (id === 'history') this.openReviewWorkspace('history');
    else if (id === 'edge') this.openReviewWorkspace('edge');
    else if (id === 'intelligence') this.openReviewWorkspace('intelligence');
    else if (id === 'symbol-edge') this.openReviewWorkspace('symbol-dna');
    else if (id === 'edge-discovery') this.openReviewWorkspace('edge-lab');
    else if (id === 'edge-lab') this.openReviewWorkspace('edge-lab');
    else if (id === 'symbol-dna') this.openReviewWorkspace('symbol-dna');
    else if (id === 'session') this.openReviewWorkspace('session');
    else if (id === 'playbooks') this.openReviewWorkspace('playbooks');
    else if (id === 'playbook-lab') this.openReviewWorkspace('playbook-lab');
    else if (id === 'trade-timeline') this.openReviewWorkspace('trade-timeline');
    else if (id === 'edge-refinement') this.openReviewWorkspace('edge-refinement');
    else if (id === 'signal-explorer') this.openReviewWorkspace('signal-explorer');
    else if (id === 'autonomous-discovery') this.openAutonomousDiscoveryLab();
    this.cdr.markForCheck();
  }

  onWorkspaceModeChange(mode: 'execution' | 'review'): void {
    if (mode === 'review') {
      this.openReviewWorkspace(this.reviewTab);
      return;
    }
    this.workspaceMode.setMode('execution');
    this.refreshAdaptiveLayout();
    this.cdr.markForCheck();
  }

  openExecutionConsole(): void {
    void this.router.navigate(['/execution-console']);
  }

  openExecutionMonitor(): void {
    void this.router.navigate(['/execution-monitor']);
  }

  openAutonomousDiscoveryLab(): void {
    void this.router.navigate(['/autonomous-discovery']);
  }

  openReviewWorkspace(tab: ReviewTabId = 'intelligence'): void {
    this.reviewTab = tab;
    this.workspaceMode.openReview(tab);
    this.ensureReviewAnalytics();
    if (tab === 'session') this.loadSessionReview();
    if (tab === 'playbooks') this.ensurePlaybooksLoaded();
    this.refreshAdaptiveLayout();
    this.cdr.markForCheck();
  }

  watchlistSymbols(): string[] {
    return this.watchlistSymbolNames;
  }

  private syncWatchlistSymbolNames(): void {
    this.watchlistSymbolNames = this.watchlist.map(w => w.symbol);
  }

  private ensureReviewAnalytics(): void {
    if (this.reviewAnalyticsLoaded) return;
    this.reviewAnalyticsLoaded = true;
    this.loadExtendedAnalytics();
    this.signalAnalytics = this.signalEdgeIntelligence.snapshot();
  }

  onBottomTab(tab: BottomTabId): void {
    const reviewMap: Partial<Record<BottomTabId, ReviewTabId>> = {
      history: 'history',
      journal: 'journal',
      edge: 'edge',
      intelligence: 'intelligence',
      session: 'session',
      playbooks: 'playbooks',
      notes: 'coaching'
    };
    const mapped = reviewMap[tab];
    if (mapped) {
      this.openReviewWorkspace(mapped);
      return;
    }
    this.bottomTab = tab;
    this.bottomExpanded = true;
    this.workflowState.saveBottomTab(tab);
    this.workflowState.saveUserExpandedBottom(true);
    this.refreshAdaptiveLayout();
    this.cdr.markForCheck();
  }

  private ensurePlaybooksLoaded(): void {
    if (this.playbooks.length) return;
    this.loadPlaybooks();
  }

  toggleBottomExpanded(): void {
    this.bottomExpanded = !this.bottomExpanded;
    this.workflowState.saveUserExpandedBottom(this.bottomExpanded);
    this.refreshAdaptiveLayout();
    this.cdr.markForCheck();
  }

  onSignalRowSelected(row: TradingSignal): void {
    if (row.symbol) this.selectSymbol(row.symbol);
    this.selectedSignalType = row.signalType;
    this.workspaceMode.setMode('execution');
    this.setChartMode('REPLAY');
    this.refreshAdaptiveLayout();
    this.cdr.markForCheck();
  }

  private loadCognition(): void {
    this.cognitionService.getSnapshot(this.selectedSymbol).pipe(takeUntil(this.destroy$)).subscribe({
      next: snap => {
        this.cognition = snap;
        this.sessionReviewLoading = false;
        this.eventBus.patchCognition(snap);
        this.cdr.markForCheck();
      },
      error: () => {
        this.sessionReviewLoading = false;
        this.cdr.markForCheck();
      }
    });
    this.loadHistoricalInsight();
    this.loadProbabilisticExecution();
  }

  private loadProbabilisticExecution(): void {
    const type = this.selectedSignalType || this.bestSetup?.signalType;
    this.probabilisticService.getSnapshot(this.selectedSymbol, type)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: snap => {
          this.probabilisticExecution = snap;
          this.applyTradeOverlay(this.executionSource);
          this.refreshExecutionState(this.executionSource);
          this.cdr.markForCheck();
        }
      });
  }

  private loadHistoricalInsight(): void {
    const type = this.selectedSignalType || this.bestSetup?.signalType;
    if (!type || type === 'WATCH') {
      this.historicalInsight = null;
      return;
    }
    this.historicalService.getInsight(type, this.selectedSymbol)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: insight => { this.historicalInsight = insight; this.cdr.markForCheck(); }
      });
  }

  historicalNotes(): string[] {
    return this.historicalInsight?.probabilisticNotes ?? [];
  }

  mergeReplayProbabilistic(replay: ReplayProbabilistic): ProbabilisticExecutionSnapshot {
    return {
      ...this.probabilisticExecution,
      probabilityDecay: replay.probabilities ?? this.probabilisticExecution.probabilityDecay,
      expectedMove: replay.expectedMove ?? this.probabilisticExecution.expectedMove,
      adaptiveExit: replay.exitGuidance ?? this.probabilisticExecution.adaptiveExit,
      failureSignature: replay.failure ?? this.probabilisticExecution.failureSignature,
      timestamp: Date.now()
    };
  }

  private loadReplayNarrative(index: number): void {
    if (this.chartMode !== 'REPLAY' || this.miniMode) return;
    this.cognitionService.getReplayNarrative(this.selectedSymbol, index)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: n => { this.replayNarrative = n; this.cdr.markForCheck(); }
      });
    const type = this.selectedSignalType || this.bestSetup?.signalType;
    this.probabilisticService.getReplay(this.selectedSymbol, index, type)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: r => { this.replayProbabilistic = r; this.cdr.markForCheck(); }
      });
  }

  emphasisClass(target: string): string {
    const e = this.cognition.visualEmphasis;
    if (!e) return '';
    if (e.highPriorityTarget === target) return e.highPriorityClass ?? '';
    if (e.mutedTargets?.includes(target)) return 'emphasis-muted';
    return '';
  }

  private loadExtendedAnalytics(): void {
    this.loadPlaybooks();
    this.loadSessionReview();
  }

  private loadPlaybooks(): void {
    this.analyticsService.getPlaybooks().pipe(takeUntil(this.destroy$)).subscribe({
      next: p => {
        this.playbooks = (p?.length ? p : DEFAULT_PLAYBOOKS);
        this.cdr.markForCheck();
      },
      error: () => {
        this.playbooks = DEFAULT_PLAYBOOKS;
        this.cdr.markForCheck();
      }
    });
  }

  private loadSessionReview(): void {
    this.sessionReviewLoading = true;
    this.analyticsService.getSessionReview().pipe(takeUntil(this.destroy$)).subscribe({
      next: r => {
        this.sessionReview = r;
        this.sessionReviewLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.sessionReviewLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private refreshConfidence(): void {
    const regime = this.marketTrend?.regime ?? 'CHOPPY';
    const type = this.selectedSignalType || this.bestSetup.signalType;
    if (!type || type === 'WATCH') {
      this.executionConfidence = [];
      this.bestSetupWinRate = null;
      return;
    }
    forkJoin({
      current: safeApi(this.analyticsService.getConfidence(type, regime), []),
      chop: safeApi(this.analyticsService.getConfidence(type, 'CHOPPY'), [])
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ current, chop }) => {
        this.executionConfidence = [...current, ...chop.filter(c => c.regime !== regime)];
        this.bestSetupWinRate = current[0]?.winRatePercent ?? null;
        this.cdr.markForCheck();
      }
    });
  }

  private loadWinRatesForSignals(): void {
    const regime = this.marketTrend?.regime ?? 'CHOPPY';
    const types = [...new Set(this.signals.slice(0, 100).map(s => s.signalType))].slice(0, 10);
    types.forEach(t => {
      if (this.regimeWinRates[t] != null) return;
      this.analyticsService.getConfidence(t, regime).pipe(takeUntil(this.destroy$)).subscribe({
        next: rows => {
          if (rows[0]) {
            this.regimeWinRates = { ...this.regimeWinRates, [t]: rows[0].winRatePercent };
            this.cdr.markForCheck();
          }
        },
        error: () => {}
      });
    });
  }

  startSidebarResize(event: MouseEvent): void {
    event.preventDefault();
    const startX = event.clientX;
    const startW = this.sidebarWidth;
    const move = (e: MouseEvent) => {
      this.sidebarWidth = Math.max(280, Math.min(520, startW - (e.clientX - startX)));
      this.cdr.markForCheck();
    };
    const up = () => {
      this.workflowState.saveSidebarWidth(this.sidebarWidth);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  syncBottomPanelState(): void {
    this.emptySignals = smartEmptyMessage('signals', this.marketTrend, this.filteredActiveSignals.length);
    if (!this.workflowState.loadUserExpandedBottom()) {
      this.bottomExpanded = false;
      if (!this.bottomTab) this.bottomTab = null;
    } else if (!this.bottomTab) {
      if (this.chartMode === 'REPLAY') this.bottomTab = 'timeline';
      else if (this.signals.length > 0) this.bottomTab = 'history';
      else if (this.journalEntries.length > 0) this.bottomTab = 'journal';
    }
  }

  loadCoaching(): void {
    this.analyticsService.getCoaching(this.selectedSymbol).subscribe({
      next: c => { this.replayCoaching = c; this.cdr.markForCheck(); },
      error: () => {}
    });
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement)?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openCommandPalette();
      return;
    }
    if (!typing && event.key === '/') {
      event.preventDefault();
      focusSymbolSwitcher();
      return;
    }
    if (this.chartMode === 'REPLAY' && !typing && !this.commandPaletteOpen) {
      if (this.signalExplorerDockOpen || this.signalExplorer.snapshot().bulkReviewActive) {
        const navKey = event.key.toLowerCase();
        if (navKey === 'n') { event.preventDefault(); void this.signalExplorer.navigate('NEXT'); return; }
        if (navKey === 'p') { event.preventDefault(); void this.signalExplorer.navigate('PREV'); return; }
        if (navKey === 'e') { event.preventDefault(); void this.signalExplorer.navigate('ELITE'); return; }
        if (navKey === 't') { event.preventDefault(); void this.signalExplorer.navigate('TRAP'); return; }
        if (navKey === 'r') { event.preventDefault(); void this.signalExplorer.navigate('RECLAIM'); return; }
        if (navKey === 's') { event.preventDefault(); void this.signalExplorer.navigate('SECOND_LEG'); return; }
      }
      if (event.code === 'Space') {
        event.preventDefault();
        if (this.replayPlaying) this.replayPause();
        else this.replayPlay();
        return;
      }
      if (event.key === 'ArrowRight' && !event.shiftKey) {
        event.preventDefault();
        this.onReplayWorkflowJump('NEXT_SIGNAL');
        return;
      }
      if (event.key === 'ArrowLeft' && !event.shiftKey) {
        event.preventDefault();
        this.onReplayWorkflowJump('PREV_SIGNAL');
        return;
      }
      if (event.key === 'ArrowRight' && event.shiftKey) {
        event.preventDefault();
        this.replayJump(5);
        return;
      }
      if (event.key === 'ArrowLeft' && event.shiftKey) {
        event.preventDefault();
        this.replayJump(-5);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        this.snapReplayToCursor('focus signal');
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.replayWorkstationUx.setStatus('PAUSED');
        this.jumpToReplayHead();
        return;
      }
    }
  }

  private snapReplayToCursor(reason: string): void {
    const idx = this.replayChartCursor >= 0 ? this.replayChartCursor : this.replaySessionStartIndex + Math.max(0, this.replayIndex);
    if (idx >= 0) {
      this.replayWorkstationUx.requestSnap(idx, reason);
    }
  }

  private snapReplayToSessionBar(sessionBarIndex: number, reason: string): void {
    const idx = this.replaySessionStartIndex + Math.max(0, sessionBarIndex);
    this.replayWorkstationUx.requestSnap(idx, reason);
  }

  private refreshReplayUxBreadcrumb(): void {
    this.replayBreadcrumb = this.replayWorkstationUx.updateBreadcrumb(
      this.selectedSymbol,
      this.replayHistory,
      this.replayChartCursor >= 0 ? this.replayChartCursor : this.replaySessionStartIndex + Math.max(0, this.replayIndex),
      this.selectedReplayEvent,
      this.replayDecisionRows
    );
    this.refreshReplayUxDebug();
  }

  private refreshReplayUxDebug(): void {
    const range = this.replayViewportState?.savedRange;
    const focused = this.selectedReplayEvent?.signalType
      ?? this.replayBreadcrumb?.decisionLabel
      ?? null;
    this.replayWorkstationUx.updateDebug(
      this.replayChartCursor >= 0 ? this.replayChartCursor : this.replayIndex,
      range?.from ?? null,
      range?.to ?? null,
      focused,
      this.replayViewportState?.autoFollowReplay ?? true
    );
  }

  onReplayPanelTab(tab: ReplayPanelTab): void {
    this.replayPanelTab = tab;
    this.replayWorkstationUx.openTab(tab);
  }

  toggleReplayBottomPanel(): void {
    this.replayWorkstationUx.toggleBottomPanel();
  }

  onReplayWorkflowJump(kind: ReplaySignalJumpKind): void {
    void this.executeReplayWorkflowJump(kind);
  }

  private async executeReplayWorkflowJump(kind: ReplaySignalJumpKind): Promise<void> {
    this.pendingReplayAction = `Jumping to ${kind.replace(/_/g, ' ').toLowerCase()}…`;
    const ws = this.replayWorkstation.snapshot();
    if (!ws.history) {
      this.pendingReplayAction = null;
      this.replayWorkstationUx.clearPendingSnap();
      return;
    }

    const inSession = this.replayWorkstation.signalJump(kind, this.replayIndex);
    if (inSession != null) {
      this.applyReplayBarJump(inSession, kind);
      return;
    }

    const adjacent = await this.replayWorkstation.signalJumpAdjacentSession(kind, this.replayIndex);
    if (!adjacent) {
      this.replayWorkstationUx.onJumpBoundary(kind);
      this.pendingReplayAction = null;
      this.cdr.markForCheck();
      return;
    }

    this.pendingReplayAction = `Loading ${adjacent.sessionDate}…`;
    await this.loadHistoricalReplay(adjacent.sessionDate, adjacent.barIndex, kind);
  }

  private applyReplayBarJump(barIndex: number, kind: ReplaySignalJumpKind): void {
    this.replayService.pause();
    this.replayViewportUx.onPause();
    this.replayService.seekToIndex(barIndex);
    this.replayWorkstationUx.onSignalJump(kind, barIndex);
    this.snapReplayToSessionBar(barIndex, kind.replace(/_/g, ' ').toLowerCase());
    if (kind.includes('ENTRY') || kind.includes('RECLAIM') || kind.includes('SIGNAL')) {
      this.replayWorkstationUx.openTab('decisions');
    }
    setTimeout(() => { this.pendingReplayAction = null; this.cdr.markForCheck(); }, 800);
    this.cdr.markForCheck();
  }

  onJournalSave(entry: TradeJournalEntry): void {
    this.tradeJournalService.create(entry).subscribe({
      next: saved => {
        this.journalEntries = [saved, ...this.journalEntries];
        this.cdr.markForCheck();
      }
    });
  }

  onJournalReview(entry: TradeJournalEntry): void {
    this.selectSymbol(entry.symbol);
    if (entry.replayLink) this.setChartMode('REPLAY');
  }

  toggleHistory(): void {
    this.bottomTab = 'history';
    this.bottomExpanded = !this.bottomExpanded;
    this.workflowState.saveUserExpandedBottom(this.bottomExpanded);
    this.cdr.markForCheck();
  }

  get isSelectedSymbolPinned(): boolean {
    const row = this.watchlist.find(w => w.symbol === this.selectedSymbol);
    return !!row?.pinned;
  }

  selectSymbol(symbol: string): void {
    const sym = symbol.toUpperCase();
    this.recentSymbols = this.workflowState.pushRecentSymbol(sym);
    this.cognitionService.invalidate(sym);
    if (sym === this.selectedSymbol) {
      this.dashboardOrchestrator.requestSymbolContextRefresh();
      this.cdr.markForCheck();
      return;
    }
    this.clearSymbolError(sym);
    if (this.chartMode === 'REPLAY') {
      this.selectedSymbol = sym;
      this.watchlistStore.setSelectedSymbol(sym);
      this.replayWorkstationUx.onSymbolChange(sym);
      this.pendingReplayAction = `Switching to ${sym}…`;
      this.candles = [];
      this.loadHistoricalReplay();
      return;
    }
    this.activateSymbol(sym, true);
  }

  onSymbolAdded(symbol: string): void {
    const sym = symbol.toUpperCase();
    this.searchLoading = true;
    this.clearSymbolError(sym);
    this.tradingSymbolService.createSymbol({
      symbol: sym,
      groupName: 'Momentum',
      scanEnabled: true,
      subscribeLive: true,
      preloadOnStartup: true,
      enabled: true
    }).pipe(
      takeUntil(this.destroy$),
      catchError(() => {
        this.setSymbolError(sym, 'Unable to load market data');
        this.searchLoading = false;
        return EMPTY;
      })
    ).subscribe({
      next: item => {
        this.refreshWatchlistFromApi(true);
        this.activateSymbol(item.symbol, true, true);
        setTimeout(() => this.sidebar?.flashAndScroll(item.symbol), 300);
      }
    });
  }

  onSymbolRemoved(symbol: string): void {
    const sym = symbol.toUpperCase();
    this.tradingSymbolService.deleteSymbol(sym).pipe(
      takeUntil(this.destroy$),
      catchError(() => EMPTY)
    ).subscribe({
      next: () => {
        this.symbolCache.delete(sym);
        this.loadedSymbols.delete(sym);
        this.clearSymbolError(sym);
        this.refreshWatchlistFromApi();
        if (this.selectedSymbol === sym) {
          const fallback = this.watchlist.find(w => w.enabled)?.symbol ?? 'NVDA';
          this.activateSymbol(fallback, true);
        }
      }
    });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.workflowState.saveLayout({ sidebarCollapsed: this.sidebarCollapsed });
  }

  onFiltersChange(filters: WorkflowFilters): void {
    this.workflowFilters = filters;
    this.workflowState.saveFilters(filters);
    this.refreshWorkflowViews();
    this.cdr.markForCheck();
  }

  regimeTintClass(): string {
    const r = this.marketTrend?.regime?.toUpperCase() ?? '';
    if (r.includes('BULL') || r === 'RISK_ON') return 'regime-tint-bull';
    if (r.includes('BEAR') || r === 'RISK_OFF') return 'regime-tint-bear';
    if (r === 'CHOPPY') return 'regime-tint-chop';
    return '';
  }

  timelineEntries() {
    return buildTimelineEntries(this.signals.filter(s => !s.symbol || s.symbol === this.selectedSymbol));
  }

  onTimelineSignalSelected(signal: TradingSignal): void {
    this.selectedSignalType = signal.signalType;
    this.refreshExecutionContext(signal);
    this.cdr.markForCheck();
  }

  onQuickReplay(): void {
    this.setChartMode('REPLAY');
  }

  onQuickPin(symbol: string): void {
    const row = this.watchlist.find(w => w.symbol === symbol);
    if (!row) return;
    this.tradingSymbolService.updateSymbol(symbol, { pinned: !row.pinned }).subscribe({
      next: () => this.refreshWatchlistFromApi(),
      error: () => {}
    });
  }

  private refreshExecutionContext(signal?: TradingSignal | null): void {
    const symRow = this.watchlist.find(w => w.symbol === this.selectedSymbol) ?? null;
    const active = this.filteredActiveSignals.find(s => s.symbol === this.selectedSymbol)
      ?? this.activeSignals.find(s => s.symbol === this.selectedSymbol);
    const latest = signal ?? this.signals.find(s => !s.symbol || s.symbol === this.selectedSymbol) ?? this.signals[0] ?? null;
    const source: SetupCandidate | null = active ?? (latest ? { ...latest, symbol: latest.symbol ?? this.selectedSymbol } : null)
      ?? (symRow ? {
          symbol: symRow.symbol,
          signalType: symRow.signalState ?? 'WATCH',
          rankScore: symRow.rankScore,
          relativeVolume: symRow.relativeVolume,
          extended: symRow.extended,
          mtfSummary: symRow.mtfSummary,
          freshness: symRow.freshness,
          regimeAligned: symRow.regimeAligned,
          optionsWarnings: symRow.optionsWarnings
        } : null);

    this.executionSource = source;
    this.selectedSignalType = source?.signalType ?? '';
    this.signalConditions = buildSignalConditions(source ?? latest, symRow, this.indicators);
    this.applyExecutionPlan(source);
    this.setupDeterioration = detectSetupDeterioration(source, symRow, this.headerIndicators, this.livePrice);
    this.sessionPrevClose = this.resolveSessionPrevClose();
    this.qualityTimeline = buildExecutionQualityTimeline(this.signals);
    if (this.chartMode !== 'REPLAY') {
      this.executionApi.getExecutionSnapshot(this.selectedSymbol).subscribe({
        next: snap => {
          this.executionSnapshot = snap;
          this.applyExecutionPlan(source);
          this.cdr.markForCheck();
        },
        error: () => {}
      });
    }
  }

  /** Phase 172–175 — unified plan; replay uses historical-only path. */
  private rebuildExecutionPlan(source: SetupCandidate | null): void {
    if (this.chartMode === 'REPLAY' && this.replayHistory) {
      this.rebuildHistoricalExecutionPlan(source);
      return;
    }

    const ctx = this.planBuildContext(source);
    const built = this.executionPlanService.buildExecutionPlan(ctx);
    this.executionPlan = built.plan;
    this.executionGuidance = this.executionPlanService.guidanceFromPlan(built.plan);
    this.historicalExecutionSnapshot = null;
    this.replayPlanDrift = [];
    this.chartExecutionLevels = this.executionPlanService.toChartLevels(this.executionPlan, this.livePrice);
  }

  private planBuildContext(source: SetupCandidate | null): import('../services/execution-plan/execution-plan.models').ExecutionPlanBuildContext {
    const autonomous = this.executionAdvisory?.liveDecision?.autonomousExecution ?? null;
    return {
      source,
      price: this.livePrice,
      indicators: this.headerIndicators,
      snapshot: this.executionSnapshot,
      extended: !!source?.extended,
      autonomousOverlay: autonomous,
      clusterFamily: autonomous?.clusterFamily ?? null,
      scannerCard: this.autonomousCards[source?.symbol ?? ''] ?? null,
      probabilistic: this.probabilisticExecution
    };
  }

  private rebuildHistoricalExecutionPlan(source: SetupCandidate | null): void {
    const barIndex = this.replayChartCursor >= 0
      ? this.replayChartCursor
      : this.replaySessionStartIndex + Math.max(0, this.replayIndex);
    const event = this.selectedReplayEvent
      ?? this.replayHistory!.timeline[0] ?? null;

    const hist = this.historicalExecution.buildSnapshot({
      history: this.replayHistory!,
      barIndex,
      symbol: this.selectedSymbol,
      signalType: source?.signalType ?? event?.signalType,
      event
    });

    this.historicalExecutionSnapshot = hist;

    this.executionPlan = hist?.executionPlan ?? null;
    this.executionGuidance = this.executionPlanService.guidanceFromPlan(this.executionPlan);

    const legacyProbe = this.executionPlanService.buildLegacyPlan(this.planBuildContext(source));
    this.replayPlanDrift = this.historicalExecution.validateDrift(hist, legacyProbe.plan);

    this.chartExecutionLevels = this.executionPlanService.toChartLevels(
      this.executionPlan,
      hist?.price ?? this.livePrice
    );
  }

  private applyExecutionPlan(source: SetupCandidate | null): void {
    this.rebuildExecutionPlan(source);
    this.applyTradeOverlay(source);
  }

  private applyTradeOverlay(source: SetupCandidate | null): void {
    const hasSetup = !!source && source.signalType !== 'WATCH';
    this.tradeStructureOverlay = this.tradeOverlayService.buildFromPlan(
      this.executionPlan,
      this.probabilisticExecution,
      hasSetup
    );
    const rr = this.tradeStructureOverlay?.rr ?? this.executionPlan?.riskReward;
    const active = this.tradeStructureOverlay?.active ?? hasSetup;
    this.tradeRrLabel = rr != null && active ? `${rr}R ACTIVE` : null;
    this.emphasizeLiveCandle = active || this.activeTradeMode;
    this.triggerLine = this.triggerLineService.build(
      source?.signalType ?? this.selectedSignalType,
      this.livePrice ?? source?.price ?? null,
      this.headerIndicators,
      this.livePrice
    );
    const marketChoppy = !!this.marketTrend?.choppy || this.marketTrend?.regime === 'CHOPPY';
    const noEdge = !!this.executionSnapshot?.noEdge || this.showNoEdgeDiscipline();
    const fail = this.probabilisticExecution.failureSignature?.failureProbability ?? 0;
    const exitState = this.probabilisticExecution.adaptiveExit?.state ?? '';
    const exitNow = exitState === 'EXIT_NOW' || exitState.includes('EXIT');
    const rvol = source?.relativeVolume ?? this.headerIndicators?.relativeVolume ?? 0;
    const nearTrigger = !!this.triggerLine && !this.triggerLine.active;
    const breakoutActive = !!this.triggerLine?.active || nearTrigger;
    const pd = this.probabilisticExecution.probabilityDecay;
    const contRising = (pd?.continuationCurrent ?? 0) > (pd?.continuationStart ?? 0) + 5;
    const trust = this.probabilisticExecution.marketTrust?.score ?? 50;
    const estimatedRr = this.executionPlan?.riskReward ?? this.executionSnapshot?.estimatedRr ?? null;
    const weakRr = estimatedRr != null && estimatedRr < 1.5;
    const lowTrust = trust < 45;
    const theta = this.probabilisticExecution.optionsExecution?.thetaRisk;
    const thetaDanger = theta === 'HIGH' || theta === 'EXTREME';
    const staleSetup = source?.freshness === 'STALE' || source?.freshness === 'AGING'
      || (this.signalAgeMinutes() ?? 0) > 40;
    const staleTrigger = nearTrigger && staleSetup;
    this.staleTrigger = staleTrigger;
    const rangeContracted = this.isRangeContracted();
    const triggerDist = this.triggerLine && this.livePrice
      ? Math.abs(this.triggerLine.price - this.livePrice) / this.livePrice * 100
      : null;
    this.tension = this.liquidityTension.resolve({
      rvol,
      rangeContracted,
      triggerProximityPct: triggerDist,
      breakoutProbability: pd?.continuationCurrent ?? 0,
      momentumAligned: contRising || !!source?.regimeAligned,
      failureMode: exitNow || fail >= 35
    });
    this.intensity = this.intensityEngine.resolve({
      marketChoppy,
      noEdge,
      exitNow,
      failPct: fail,
      rvol,
      nearTrigger,
      triggerActive: !!this.triggerLine?.active,
      tradeActive: !!this.tradeStructureOverlay?.active,
      continuationRising: contRising,
      weakRr,
      lowTrust,
      thetaDanger,
      staleTrigger,
      staleSetup,
      tensionScore: this.tension.score
    });
    const silenceActive = (this.intensity.mode === 'CHOP'
      || ((weakRr || staleTrigger || staleSetup) && (lowTrust || thetaDanger || noEdge)))
      && !exitNow && !this.triggerLine?.active && fail < 28;
    const mtfAligned = !!source?.regimeAligned
      || (source?.mtfSummary?.toLowerCase().includes('bullish') ?? false);
    const trustRising = trust >= 52 && contRising;
    this.gravity = this.attentionGravity.resolve({
      intensityMode: this.intensity.mode,
      exitNow,
      failPct: fail,
      nearTrigger,
      triggerActive: !!this.triggerLine?.active,
      rvol,
      estimatedRr,
      silenceActive,
      mtfAligned,
      trustRising
    });
    this.liquidity = this.visualLiquidity.resolve({
      rvol,
      rangeContracted,
      velocity: pd?.continuationCurrent ?? 0,
      rejectionFrequency: fail,
      candleOverlap: rangeContracted
    });
    this.breathing = this.marketBreathing.resolve({
      tensionScore: this.tension.score,
      regime: this.marketTrend?.regime ?? null,
      rvol,
      triggerProximityPct: triggerDist,
      failureProbability: fail,
      intensityMode: this.intensity.mode,
      silenceActive: this.gravity.silenceActive,
      chartTightness: this.tension.chartTightness,
      ambientBreathing: this.tension.ambientBreathing
    });
    this.pressure = this.convictionPressure.resolve({
      intensityMode: this.intensity.mode,
      corridorBias: this.gravity.corridorBias,
      silenceActive: this.gravity.silenceActive,
      holdBreath: this.breathing.holdBreath
    });
    this.temporal = this.temporalDecay.resolve({
      barsSinceSignal: this.signalAgeMinutes(),
      signalAgeMinutes: this.signalAgeMinutes(),
      momentumLoss: !contRising && fail >= 18,
      rvolCollapse: rvol < 1.4,
      trustDeteriorating: lowTrust || trust < 50,
      staleSetup,
      staleTrigger,
      rankIndex: 0,
      failed: exitNow || fail >= 38,
      nearTrigger
    });
    this.priority = this.priorityMatrix.resolve({
      intensityMode: this.intensity.mode,
      exitNow,
      silenceActive: this.gravity.silenceActive,
      failPct: fail
    });
    const forget = this.temporal.globalForget;
    this.gravity = {
      ...this.gravity,
      labelWeights: Object.fromEntries(
        Object.entries(this.gravity.labelWeights).map(([k, v]) => [k, v * forget])
      ) as Record<string, number>,
      triggerSoftness: this.gravity.triggerSoftness * this.temporal.triggerOpacity,
      liveCandleDominance: this.gravity.liveCandleDominance * this.liquidity.liveCandleBoost * 0.85
    };
    this.depth = this.microDepth.resolve({
      intensityMode: this.intensity.mode,
      tensionScore: this.tension.score,
      silenceActive: this.gravity.silenceActive,
      corridorBias: this.gravity.corridorBias,
      maDepth: this.intensity.maDepth,
      historyFade: this.intensity.historyFade,
      candleEmphasis: this.intensity.candleEmphasis,
      liveCandleDominance: this.gravity.liveCandleDominance
    });
    this.calmMode = this.intensity.calmMode || this.gravity.silenceActive;
    this.urgencyEscalation = false;
    this.liveCandlePulse = false;
    this.nextAction = this.nextActionService.resolve(
      source,
      this.probabilisticExecution,
      this.triggerLine,
      marketChoppy,
      noEdge
    );
    this.chartCognitionPills = selectChartCognitionPills(
      source,
      this.probabilisticExecution,
      nearTrigger,
      {
        nearTrigger,
        urgencyActive: this.urgencyEscalation,
        exitNow,
        failureElevated: fail >= 30,
        rvolSpike: rvol >= 3,
        breakoutActive
      }
    );
    this.overlayIntelContext = {
      adaptiveExit: this.probabilisticExecution.adaptiveExit?.state ?? null,
      deterioration: this.setupDeterioration?.state ?? null,
      failurePct: fail,
      continuationRising: contRising,
      exitNow,
      labelSharpness: Math.max(this.intensity.labelSharpness, this.tension.labelSharpness)
        * this.gravity.chartSharpness * this.liquidity.triggerClarity,
      breakoutMode: this.intensity.mode === 'BREAKOUT' || this.intensity.mode === 'TRIGGER'
    };
    this.focusPulse = this.livePriceFocus.resolve({
      tradeActive: !!this.tradeStructureOverlay?.active,
      failurePct: fail,
      triggerNear: nearTrigger,
      triggerActive: !!this.triggerLine?.active,
      adaptiveExit: this.probabilisticExecution.adaptiveExit?.state ?? null,
      replayMode: this.chartMode === 'REPLAY',
      calmMode: this.calmMode && !this.urgencyEscalation
    });
    this.refreshAdaptiveLayout();
    this.refreshExecutionState(source);
  }

  refreshAdaptiveLayout(): void {
    this.adaptiveLayout = this.workspaceLayout.resolve({
      tradeMode: this.activeTradeMode,
      bottomExpanded: this.bottomExpanded,
      bottomTabActive: this.bottomTab != null && this.bottomExpanded,
      replayPanelVisible: this.chartMode === 'REPLAY' && !!this.replayCoaching,
      hasLiveOpportunities: this.hasLiveOpportunities(),
      emergingCount: this.emergingSetups.length,
      activeSignalCount: this.filteredActiveSignals.length,
      miniMode: this.miniMode,
      focusMode: this.focusMode,
      nextActionVisible: !!this.nextAction && !this.miniMode,
      executionWorkspace: this.workspaceMode.isExecution()
    });
  }

  /** Execution workspace — sidebar stays trader-readable (intensity dimming is research/calm only). */
  executionSidebarOpacity(): number {
    if (this.workspaceMode.isExecution() && !this.miniMode) {
      return Math.max(this.intensity.sidebarOpacity, 0.95);
    }
    return this.intensity.sidebarOpacity;
  }

  /** Trade-mode rail must stay legible — never crush primary metrics with CHOP dimming. */
  executionRailDim(): number {
    if (!this.activeTradeMode) return 1;
    const raw = this.intensity.railDim * this.gravity.railContrast;
    if (this.intensity.mode === 'FAILURE' || this.priority.dominantPath === 'exit') {
      return 1;
    }
    return Math.max(0.82, raw);
  }

  workspaceLuminance(): number {
    return 1 - clampBottomCompositeDarkness(
      clampCompositeDarkness(this.breathing.luminanceReduction)
    );
  }

  chartFocusMode(): 'TODAY' | 'MULTI_DAY' | 'REPLAY' {
    if (this.chartMode === 'REPLAY' || this.chartTimeframe === 'REPLAY') return 'REPLAY';
    if (this.chartTimeframe === 'MULTI_DAY') return 'MULTI_DAY';
    return 'TODAY';
  }

  private computeLiveCandlePulse(source: SetupCandidate | null): boolean {
    if (this.chartMode === 'REPLAY') return false;
    const rvol = source?.relativeVolume ?? this.headerIndicators?.relativeVolume ?? 0;
    const fail = this.probabilisticExecution.failureSignature?.failureProbability ?? 0;
    const active = !!this.tradeStructureOverlay?.active;
    return active || rvol >= 3 || fail >= 35
      || (source?.signalType?.includes('OPEN_MOM') ?? false);
  }

  private buildExecutionStateContext(source: SetupCandidate | null): ExecutionStateContext {
    const pe = this.probabilisticExecution;
    const pd = pe.probabilityDecay;
    const nearEmerging = this.emergingSetups.some(
      e => e.symbol === this.selectedSymbol && e.state === 'NEAR_TRIGGER'
    );
    const nearTrigger = nearEmerging || (!!this.triggerLine && !this.triggerLine.active);
    return {
      replayMode: this.chartMode === 'REPLAY',
      hasValidSetup: !!source && source.signalType !== 'WATCH',
      trustScore: pe.marketTrust?.score ?? null,
      failurePct: pe.failureSignature?.failureProbability ?? null,
      continuationCurrent: pd?.continuationCurrent ?? null,
      continuationStart: pd?.continuationStart ?? null,
      estimatedRr: this.executionPlan?.riskReward ?? this.executionSnapshot?.estimatedRr ?? null,
      freshness: source?.freshness ?? null,
      relativeVolume: source?.relativeVolume ?? null,
      regimeAligned: source?.regimeAligned ?? null,
      tradeActive: !!this.tradeStructureOverlay?.active,
      setupMaturity: pe.setupMaturity?.stage ?? null,
      adaptiveExit: pe.adaptiveExit?.state ?? null,
      deterioration: this.setupDeterioration?.state ?? null,
      noEdge: !!this.executionSnapshot?.noEdge || this.showNoEdgeDiscipline(),
      nearTrigger,
      triggerActive: !!this.triggerLine?.active
    };
  }

  private refreshExecutionState(source: SetupCandidate | null): void {
    this.executionStateService.evaluate(this.buildExecutionStateContext(source));
    this.refreshSignalIntelligence();
  }

  private refreshSignalIntelligence(): void {
    if (this.chartMode === 'REPLAY' || !this.selectedSymbol) return;
    if (this.intelligenceOffload.isEnabled()) {
      this.intelligenceOffload.prefetchForSymbol(this.selectedSymbol);
    }
    const source = this.executionSource;
    this.signalIntelligence.onSymbolContext(
      {
        symbol: this.selectedSymbol,
        signalType: source?.signalType ?? this.selectedSignalType,
        marketRegime: this.marketTrend?.regime,
        intensityMode: this.intensity.mode,
        timeframe: '5MIN',
        entryPrice: this.executionSnapshot?.entryPrice ?? source?.price ?? this.livePrice,
        stopPrice: this.executionSnapshot?.stopZone ?? this.executionSnapshot?.invalidationLevel,
        targetPrice: this.executionSnapshot?.targetPrice,
        riskReward: this.executionSnapshot?.estimatedRr ?? source?.estimatedRr,
        convictionScore: source?.confidenceScore ?? source?.tradeQualityScore,
        rvol: source?.relativeVolume,
        trendAlignment: source?.rankScore ?? null,
        execution: this.executionSnapshot,
        activeSignal: this.activeSignals.find(s => s.symbol === this.selectedSymbol) ?? null
      },
      this.candles,
      this.executionState
    );
    this.refreshExecutionAdvisory(source);
  }

  private refreshExecutionAdvisory(source: SetupCandidate | null): void {
    const lastCandle = this.candles[this.candles.length - 1];
    const ts = lastCandle?.time ? new Date(lastCandle.time as string).getTime() : Date.now();
    this.executionAdvisory = this.executionAdvisoryService.forSymbol(this.selectedSymbol, {
      symbol: this.selectedSymbol,
      signalType: source?.signalType ?? this.selectedSignalType,
      marketRegime: this.marketTrend?.regime,
      regimeAligned: source?.regimeAligned,
      rvol: source?.relativeVolume ?? undefined,
      vwapDistance: this.indicators?.vwap != null && this.livePrice
        ? (this.livePrice - this.indicators.vwap) / this.livePrice
        : undefined,
      trendAlignment: source?.rankScore ?? undefined,
      sessionTimeMinutes: this.sessionMinutesFromTs(ts),
      volatility: source?.price && this.executionSnapshot?.stopZone
        ? Math.abs(source.price - this.executionSnapshot.stopZone) / source.price
        : undefined,
      entryQuality: this.executionGuidance?.entryQuality ?? (source?.freshness === 'STALE' ? 'LATE' : undefined),
      watchlist: this.watchlistSymbolNames,
      signalAgeMinutes: this.signalAgeMinutes(),
      extended: source?.extended ?? false
    });
    if (source) {
      if (this.chartMode === 'REPLAY') {
        this.rebuildHistoricalExecutionPlan(source);
      } else {
        this.rebuildExecutionPlan(source);
      }
    }
    this.cdr.markForCheck();
  }

  private sessionMinutesFromTs(ts: number): number {
    const d = new Date(ts);
    const etTotal = d.getUTCHours() * 60 + d.getUTCMinutes() - 5 * 60;
    const open = 9 * 60 + 30;
    return Math.max(0, etTotal - open);
  }

  showBestSetupCta(): boolean {
    return !this.bestSetupCtaDismissed && !this.activeTradeMode
      && this.bestSetup.symbol !== '—'
      && this.bestSetup.symbol !== this.selectedSymbol
      && this.chartMode === 'LIVE';
  }

  dismissBestSetupCta(): void {
    this.bestSetupCtaDismissed = true;
    sessionStorage.setItem('bestSetupCtaDismissed', '1');
    this.cdr.markForCheck();
  }

  onSwitchToBestSetup(sym: string): void {
    this.selectSymbol(sym);
    this.chartLiveState.returnToLive();
    this.cdr.markForCheck();
  }

  showNoEdgeDiscipline(): boolean {
    if (this.activeTradeMode) return false;
    const chop = this.marketTrend?.regime === 'CHOPPY' || this.marketTrend?.choppy;
    const lowTrust = (this.probabilisticExecution.marketTrust?.score ?? 100) < 45;
    const weakRr = (this.executionPlan?.riskReward ?? this.executionSnapshot?.estimatedRr ?? 99) < 1.5;
    const stale = this.executionSource?.freshness === 'STALE' || this.executionSource?.freshness === 'AGING';
    return (chop || lowTrust || weakRr || stale || !this.hasLiveOpportunities())
      && this.executionState === 'WATCHING';
  }

  signalAgeMinutes(): number | null {
    const sym = this.watchlist.find(w => w.symbol === this.selectedSymbol);
    return sym?.freshness ? (sym as { ageMinutes?: number }).ageMinutes ?? null : null;
  }

  private isRangeContracted(): boolean {
    const c = this.candles;
    if (c.length < 12) return false;
    const recent = c.slice(-3);
    const prior = c.slice(-12, -3);
    const avgRange = (bars: typeof c) => {
      const ranges = bars.map(b => (b.high - b.low) / Math.max(b.close, 1));
      return ranges.reduce((a, b) => a + b, 0) / ranges.length;
    };
    return avgRange(recent) < avgRange(prior) * 0.75;
  }

  replaySimLabel(): string | null {
    if (this.chartMode !== 'REPLAY' || !this.replayHistory?.sessionCandles?.length || this.replayIndex < 0) return null;
    const bar = this.replayHistory.sessionCandles[this.replayIndex];
    return bar?.time?.slice(11, 16) ?? `Bar ${this.replayIndex}`;
  }

  disciplineModeClass(): boolean {
    return this.showNoEdgeDiscipline();
  }

  private resolveSessionPrevClose(): number | null {
    if (this.candles.length < 2) return null;
    const lastDay = this.candles[this.candles.length - 1].time.slice(0, 10);
    for (let i = this.candles.length - 2; i >= 0; i--) {
      const day = this.candles[i].time.slice(0, 10);
      if (day !== lastDay) return this.candles[i].close;
    }
    return null;
  }

  private refreshWorkflowViews(): void {
    this.filteredActiveSignals = sortActiveSignals(
      applyWorkflowFilters(this.activeSignals, this.workflowFilters, this.autonomousCards)
    );
    this.filteredWatchlist = filterWatchlist(this.watchlist, this.workflowFilters, this.autonomousCards);
    const wl = this.filteredWatchlist.length ? this.filteredWatchlist : this.watchlist;
    this.bestSetup = pickBestSetup(
      this.filteredActiveSignals,
      this.hotMomentum,
      this.openingMomentum,
      this.continuationSetups,
      wl
    );
    this.bestSetupWeak = computeAttentionScore(this.bestSetup) < 45;
    this.refreshSignalContext();
  }

  private refreshSignalContext(): void {
    this.refreshExecutionContext(null);
    this.dashboardOrchestrator.requestSymbolContextRefresh();
  }

  setChartTimeframe(tf: ChartTimeframe): void {
    this.chartLiveState.setChartTimeframe(tf);
    if (tf === 'REPLAY') {
      this.setChartMode('REPLAY');
    } else {
      if (this.chartMode === 'REPLAY') {
        this.setChartMode('LIVE');
      }
      this.applyDisplayCandles();
    }
    this.cdr.markForCheck();
  }

  private applyDisplayCandles(): void {
    const source = this.chartMode === 'LIVE' ? this.liveCandles : this.candles;
    const tf = this.chartTimeframe === 'REPLAY' ? 'REPLAY' : this.chartTimeframe;
    this.displayCandles = filterCandlesByTimeframe(source, tf);
    if (this.chartMode === 'LIVE') {
      this.candles = this.displayCandles;
      this.sessionPrevClose = calcPrevClose(this.liveCandles);
    }
    if (this.chartTimeframe === 'TODAY' && this.chartMode === 'LIVE') {
      this.emphasizeLiveCandle = true;
    }
  }

  setChartMode(mode: 'LIVE' | 'REPLAY'): void {
    if (mode === this.chartMode) return;
    this.chartMode = mode;
    this.workflowState.saveLayout({ chartMode: mode });
    this.replayService.setMode(mode);
    if (mode === 'LIVE') {
      this.replayViewportUx.onReplaySessionEnd();
      this.candles = this.liveCandles;
      this.signals = this.liveSignals;
      this.indicators = this.liveIndicators;
      this.replayError = null;
      this.chartLiveState.setLiveLocked();
      if (this.chartTimeframe === 'REPLAY') {
        this.chartLiveState.setChartTimeframe('TODAY');
      }
      this.applyDisplayCandles();
    } else {
      this.replayDate = lastTradingDayIso();
      this.chartLiveState.setChartTimeframe('REPLAY');
      this.loadHistoricalReplay();
      this.loadCoaching();
      this.chartLiveState.setReplayMode();
    }
    this.syncBottomPanelState();
    this.cdr.markForCheck();
  }

  returnToLive(): void {
    this.chartLiveState.returnToLive();
  }

  onFollowLatestChange(follow: boolean): void {
    this.chartLiveState.syncFromChart(this.chartMode, follow);
  }

  toggleActiveTradeMode(): void {
    this.activeTradeModeService.toggle();
    const active = this.activeTradeModeService.isActive();
    this.workflowState.saveActiveTradeMode(active);
    if (active) {
      this.focusMode = true;
      this.workflowState.saveFocusMode(true);
      this.bottomExpanded = false;
    } else {
      this.focusMode = false;
      this.workflowState.saveFocusMode(false);
    }
    this.refreshAdaptiveLayout();
    this.cdr.markForCheck();
  }

  hasLiveOpportunities(): boolean {
    return this.filteredActiveSignals.length > 0 || this.emergingSetups.length > 0;
  }

  strongestSector(): string | null {
    const notes = this.probabilisticExecution.topPriorities ?? [];
    const sector = notes.find(n => n.toLowerCase().includes('sector'));
    if (sector) return sector.replace(/.*sector/i, '').trim() || sector;
    return this.marketTrend?.semiBreadth ?? null;
  }

  breadthQuality(): string | null {
    if (!this.marketTrend) return null;
    const parts = [this.marketTrend.semiBreadth, this.marketTrend.aiBreadth].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }

  coachingRibbonHighlights(): string[] {
    return (this.cognition.coachingFeed ?? [])
      .slice(0, 2)
      .map(item => item.message)
      .filter(Boolean);
  }

  liveCoachingHint(): string | null {
    return this.aiCompactLine() || (this.coachingRibbonHighlights()[0] ?? this.cognition.sessionPriority?.insight ?? null);
  }

  aiCompactLine(): string | null {
    const card = this.autonomousCards[this.selectedSymbol];
    if (card) return buildCompactSuggestion(card);
    const line = formatAiCompactLine(this.aiExecution);
    return line || null;
  }

  /** Phase 178 — scanner snapshot without global plan rebuild. */
  private applyScannerFromStoreLight(): void {
    const snap = this.dashboardStore.snapshot().scanner;
    if (!snap) return;
    this.scannerSnapshot = snap;
    const map: Record<string, ScannerOpportunityCard> = { ...this.autonomousCards };
    for (const c of this.collectScannerCards(snap)) {
      const prev = map[c.symbol];
      const merged = prev?.executionPlan
        ? { ...c, executionPlan: prev.executionPlan, entryZoneLabel: prev.entryZoneLabel }
        : c;
      if (!map[c.symbol] || merged.convictionScore > (map[c.symbol]?.convictionScore ?? 0)) {
        map[c.symbol] = merged;
      }
    }
    this.autonomousCards = map;
  }

  /** Tier-2 — execution plan for focused symbol only. */
  private applyScannerPlansForFocus(): void {
    const snap = this.dashboardStore.snapshot().scanner;
    if (!snap) return;
    const sym = this.selectedSymbol;
    const card = this.findScannerCard(snap, sym);
    if (!card) return;
    const [updated] = this.executionPlanService.attachPlansToScannerCards([card], {
      priceForSymbol: s => this.watchlist.find(w => w.symbol === s)?.price ?? null,
      indicatorsForSymbol: s => (s === sym ? this.headerIndicators : null)
    });
    this.autonomousCards = { ...this.autonomousCards, [sym]: updated };
    this.scannerSnapshot = this.patchScannerSnapshotCard(snap, updated);
  }

  private collectScannerCards(snap: ScannerSnapshot): ScannerOpportunityCard[] {
    return [
      ...snap.topOpportunities,
      ...snap.highContinuation,
      ...snap.earlyExpansion,
      ...snap.institutionalPersistence,
      ...snap.healthyPullback,
      ...snap.compressionBreakout,
      ...snap.exhaustionAvoid
    ];
  }

  private findScannerCard(snap: ScannerSnapshot, symbol: string): ScannerOpportunityCard | null {
    const sym = symbol.toUpperCase();
    return this.collectScannerCards(snap).find(c => c.symbol === sym) ?? null;
  }

  private patchScannerSnapshotCard(
    snap: ScannerSnapshot,
    card: ScannerOpportunityCard
  ): ScannerSnapshot {
    const patch = (list: ScannerOpportunityCard[]) =>
      list.map(c => (c.symbol === card.symbol ? card : c));
    return {
      ...snap,
      topOpportunities: patch(snap.topOpportunities),
      highContinuation: patch(snap.highContinuation),
      earlyExpansion: patch(snap.earlyExpansion),
      institutionalPersistence: patch(snap.institutionalPersistence),
      healthyPullback: patch(snap.healthyPullback),
      compressionBreakout: patch(snap.compressionBreakout),
      exhaustionAvoid: patch(snap.exhaustionAvoid)
    };
  }

  private attachPlansToEnriched(items: import('../services/execution-intelligence/enriched-opportunity.model').EnrichedOpportunity[]) {
    return items.map(e => {
      const card = this.autonomousCards[e.symbol];
      if (card?.executionPlan) {
        return { ...e, executionPlan: card.executionPlan, entryZoneLabel: formatEntryZoneRange(card.executionPlan) };
      }
      return e;
    });
  }

  onSidebarExecutionFocus(symbol: string): void {
    const sym = symbol.toUpperCase();
    this.workspaceMode.setMode('execution');
    if (this.chartMode === 'REPLAY') {
      this.setChartMode('LIVE');
    }
    if (sym !== this.selectedSymbol) {
      this.selectSymbol(sym);
    } else {
      this.dashboardOrchestrator.requestSymbolContextRefresh();
    }
    this.edgeLabFocusSymbol = sym;
    this.edgeLabInitialTab = 'execution';
    this.refreshAdaptiveLayout();
    this.cdr.markForCheck();
  }

  onRtExecutionModeChange(mode: ExecutionFrameworkMode167): void {
    this.rtExecutionMode = mode;
    this.rtExecution.setExecutionMode(mode);
    this.cdr.markForCheck();
  }

  private refreshAiExecution(): void {
    const sig = this.selectedSignalType || this.bestSetup.signalType || 'WATCH';
    this.aiExecutionIntelligence.analyzeExecution(this.selectedSymbol, sig)
      .then(r => {
        this.aiExecution = r;
        this.cdr.markForCheck();
      })
      .catch(() => {});
  }

  onReplayDateChange(date: string): void {
    this.replayDate = date;
    this.loadHistoricalReplay(date);
  }

  loadHistoricalReplay(sessionDate?: string, seekIndex?: number, jumpKind?: ReplaySignalJumpKind): Promise<void> {
    this.replayLoading = true;
    this.replayError = null;
    const targetDate = sessionDate ?? this.replayDate;
    this.replayWorkstationUx.onSessionLoadStart(this.selectedSymbol, targetDate);
    this.pendingReplayAction = `Loading session ${targetDate}…`;
    this.replayViewportUx.onReplaySessionEnd();
    this.tradingChart?.resetReplayChartViewport();

    const load = sessionDate
      ? this.replayWorkstation.loadSession(this.selectedSymbol, targetDate)
      : this.replayWorkstation.openWorkstation(this.selectedSymbol, targetDate);

    return load.then(history => {
      this.replayLoading = false;
      this.pendingReplayAction = null;
      const ws = this.replayWorkstation.snapshot();
      if (!history?.sessionCandles.length) {
        this.replayError = ws.error ?? 'Failed to load replay session';
        this.replayWorkstationUx.setStatus('READY');
        this.cdr.markForCheck();
        return;
      }
      this.replayError = null;
      this.replayDate = history.replayDate;
      const cursor = seekIndex != null ? seekIndex : ws.cursorIndex;
      this.replayService.setHistory(history, cursor);
      if (!ws.cacheHit) {
        this.signalIntelligence.bootstrapFromReplay(history, this.intensity.mode);
      }
      this.replayViewportUx.onReplaySessionStart(this.selectedSymbol, history.replayDate, cursor);
      this.replayWorkstationUx.onSessionLoadComplete(ws.displayMode === 'REVIEW', this.replayPlaying);
      this.refreshReplayUxBreadcrumb();
      const snapLabel = jumpKind
        ? jumpKind.replace(/_/g, ' ').toLowerCase()
        : 'session load';
      requestAnimationFrame(() => {
        this.snapReplayToSessionBar(cursor, snapLabel);
        if (jumpKind) {
          this.replayWorkstationUx.openTab('decisions');
        }
      });
      this.cdr.markForCheck();
    }).catch(() => {
      this.replayLoading = false;
      this.pendingReplayAction = null;
      this.replayError = 'Failed to load replay session';
      this.replayWorkstationUx.setStatus('READY');
      this.cdr.markForCheck();
    });
  }

  async onReplaySessionSelect(sessionDate: string): Promise<void> {
    if (!sessionDate || sessionDate === this.replayDate) return;
    this.replayDate = sessionDate;
    this.loadHistoricalReplay(sessionDate);
  }

  async onReplaySessionNav(direction: 'prev' | 'next' | 'best' | 'conviction'): Promise<void> {
    let target: string | null = null;
    if (direction === 'prev') target = this.replayWorkstation.navigatePrevious();
    else if (direction === 'next') target = this.replayWorkstation.navigateNext();
    else if (direction === 'best') target = this.replayWorkstation.jumpToBestSetup();
    else if (direction === 'conviction') target = this.replayWorkstation.jumpToHighConviction();
    if (target) await this.onReplaySessionSelect(target);
  }

  onReplayScrub(index: number): void {
    this.replayService.pause();
    this.replayViewportUx.onPause();
    this.replayService.seekToIndex(index);
    this.snapReplayToSessionBar(index, 'scrub');
    this.refreshReplayUxBreadcrumb();
  }

  onReplayDecisionScrub(barIndex: number): void {
    this.onReplayScrub(barIndex);
    this.replayWorkstationUx.openTab('decisions');
  }

  onReplaySignalJump(kind: ReplaySignalJumpKind): void {
    this.onReplayWorkflowJump(kind);
  }

  onReplayDisplayModeChange(mode: ReplayDisplayMode): void {
    this.replayWorkstation.setDisplayMode(mode);
    if ((mode === 'REVIEW' || mode === 'TRAINING') && this.replayHistory) {
      this.replayService.seekToIndex(this.replayHistory.sessionCandles.length - 1);
    }
    this.refreshReplayView();
  }

  onReplayWorkstationModeChange(mode: ReplayWorkstationMode): void {
    this.replayWorkstation.setWorkstationMode(mode);
    this.loadHistoricalReplay(this.replayDate);
  }

  onReplayStartModeChange(mode: ReplayStartMode): void {
    this.replayWorkstation.setStartMode(mode);
    const ws = this.replayWorkstation.snapshot();
    if (ws.history) {
      const idx = this.replayWorkstation.resolveStartIndex(ws.history, mode);
      this.replayService.seekToIndex(idx);
    }
  }

  replayPlay(): void {
    this.replayViewportUx.onPlay();
    this.replayService.play();
  }

  replayPause(): void {
    this.replayViewportUx.onPause();
    this.replayService.pause();
  }

  replayStep(): void {
    this.replayService.stepForward();
  }

  replayStepBack(): void {
    this.replayService.stepBack();
  }

  replayJump(delta: number): void {
    this.replayService.stepJump(delta);
  }

  replaySpeedChange(speed: ReplaySpeed): void {
    const allowed: ReplaySpeed[] = [1, 2, 5];
    this.replayService.setSpeed(allowed.includes(speed) ? speed : 1);
  }

  onReplayEventSelected(ev: ReplaySignalEvent): void {
    this.replayViewportUx.onSignalInspection();
    this.replayService.selectEvent(ev);
    this.snapReplayToCursor('timeline event');
    this.refreshReplayUxBreadcrumb();
    this.replayWorkstationUx.openTab('inspector');
  }

  onChartReplayEvent(ev: ReplaySignalEvent): void {
    this.replayService.selectEvent(ev);
  }

  jumpToReplayHead(): void {
    this.tradingChart?.focusReplayHead();
    this.cdr.markForCheck();
  }

  toggleSignalExplorerDock(): void {
    this.signalExplorerDockOpen = !this.signalExplorerDockOpen;
    if (this.signalExplorerDockOpen) {
      void this.signalExplorer.loadSymbol(this.selectedSymbol);
    }
    this.cdr.markForCheck();
  }

  private consumeReplayLaunchPlan(): SignalReplayLaunchPlan | null {
    const fromIntent = this.replayLaunchIntent.consume();
    if (fromIntent) return fromIntent;
    const state = history.state?.['replayPlan'] as SignalReplayLaunchPlan | undefined;
    if (state?.signalId && state.symbol && state.sessionDate) return state;
    return null;
  }

  private prepareReplayLaunch(plan: SignalReplayLaunchPlan): void {
    const sym = plan.symbol.toUpperCase();
    this.selectedSymbol = sym;
    this.watchlistStore.setSelectedSymbol(sym);
    this.dashboardStore.setSelectedSymbol(sym);
    if (this.workspaceMode.isReview()) {
      this.workspaceMode.setMode('execution');
    }
    this.chartLoading = false;
    this.chartReady = true;
    this.replayDate = plan.sessionDate;
    if (this.chartMode !== 'REPLAY') {
      this.chartMode = 'REPLAY';
      this.workflowState.saveLayout({ chartMode: 'REPLAY' });
      this.dashboardStore.setChartMode('REPLAY');
      this.replayService.setMode('REPLAY');
      this.chartLiveState.setChartTimeframe('REPLAY');
      this.chartLiveState.setReplayMode();
      this.syncBottomPanelState();
    }
  }

  private async launchReplayFromPlan(plan: SignalReplayLaunchPlan): Promise<void> {
    this.prepareReplayLaunch(plan);
    await this.jumpToHistoricalSignal(plan);
  }

  async jumpToHistoricalSignal(plan: SignalReplayLaunchPlan): Promise<void> {
    const sym = plan.symbol.toUpperCase();
    this.prepareReplayLaunch(plan);
    this.signalExplorerDockOpen = true;
    this.replayWorkstation.setDisplayMode(
      plan.replayMode === 'TRAIN_FROM_SIGNAL' ? 'TRAINING' : 'REVIEW'
    );

    let signalBar = plan.candleIndex ?? plan.replayIndex;
    if (signalBar < 0 && plan.timestampMs) {
      const peek = await this.replayWorkstation.loadSession(sym, plan.sessionDate);
      if (peek?.sessionCandles?.length) {
        signalBar = await this.signalJump.resolveBarIndex(peek, plan.timestampMs);
      }
    }
    const barsBefore = plan.barsBeforeSignal ?? 10;
    const seekIdx = plan.replayMode === 'TRAIN_FROM_SIGNAL'
      ? Math.max(0, signalBar >= 0 ? signalBar - barsBefore : 0)
      : signalBar >= 0 ? signalBar : undefined;

    await this.loadHistoricalReplay(plan.sessionDate, seekIdx);
    const snapBar = signalBar >= 0 ? signalBar : (seekIdx ?? 0);
    requestAnimationFrame(() => {
      this.snapReplayToSessionBar(snapBar, 'discovery review');
      this.replayWorkstationUx.openTab('decisions');
      this.cdr.markForCheck();
    });
  }

  onSignalExplorerNav(kind: SignalNavKind): void {
    void this.signalExplorer.navigate(kind);
  }

  private refreshReplayView(): void {
    if (this.chartMode !== 'REPLAY' || !this.replayHistory) return;
    const ws = this.replayWorkstation.snapshot();
    const reviewMode = ws.displayMode === 'REVIEW';
    const ctx = this.replayWorkstation.buildDisplayContext(
      this.replayHistory,
      this.replayIndex,
      reviewMode,
      ws
    );

    if (this.replayIndex < 0 && !reviewMode) {
      this.candles = ctx.candles;
      this.signals = [];
      this.visibleReplayTimeline = [];
      this.visibleReplayScores = [];
      return;
    }

    this.candles = ctx.candles;
    this.signals = ctx.signals;
    this.replayChartCursor = ctx.cursorIndex;
    this.replaySessionStartIndex = ctx.sessionStartIndex;
    this.visibleReplayTimeline = ctx.timeline;
    this.visibleReplayScores = reviewMode
      ? this.replayHistory.scoreHistory
      : this.replayService.visibleScoreHistory();
    this.indicators = null;
    this.updateLivePrice();
    this.replayNarrativeBands = this.replayReview.narrativeEngine.buildBands(this.replayHistory);
    this.replayDecisionRows = this.replayReview.timelineEngine.buildRows(
      this.replayHistory,
      this.replayIndex,
      reviewMode
    );
    const entry = ws.sessions.find(s => s.sessionDate === this.replayHistory!.replayDate);
    this.replayReviewSummary = this.replayReview.buildReviewSummary(
      this.replayHistory,
      entry?.healthLabel ?? entry?.status ?? 'READY'
    );
    const replaySource = this.executionSource ?? {
      symbol: this.selectedSymbol,
      signalType: this.selectedSignalType || 'CONT_BUY'
    };
    this.rebuildHistoricalExecutionPlan(replaySource);
    this.applyTradeOverlay(replaySource);
    this.cdr.markForCheck();
  }

  onReplayContextModeChange(mode: ReplayContextMode): void {
    this.replayWorkstation.setContextMode(mode);
    this.loadHistoricalReplay(this.replayDate);
  }

  private replayEventToSignal(e: ReplaySignalEvent): TradingSignal {
    return {
      symbol: this.selectedSymbol,
      signalType: e.signalType,
      timestamp: e.timestamp,
      price: e.price,
      rsi: null,
      lifecycleState: e.lifecycleState,
      confidenceScore: e.score ?? undefined,
      confidenceLabel: e.setupLabel ?? undefined,
      relativeVolume: e.rvol ?? undefined,
      vwap: e.vwap ?? undefined,
      signalReason: e.passedConditions?.join(' · '),
      extended: e.extended
    };
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
  }

  private activateSymbol(symbol: string, fromUserClick: boolean, rollbackOnFail = false): void {
    const sym = symbol.toUpperCase();
    this.selectedSymbol = sym;
    this.dashboardStore.setSelectedSymbol(sym);
    this.watchlistStore.setSelectedSymbol(sym);
    if (fromUserClick) {
      this.tradingSymbolService.recordView(sym).subscribe({ error: () => {} });
    }
    this.setSymbolLoading(sym, true);
    this.searchLoading = fromUserClick;
    const cached = this.symbolCache.get(sym);

    if (cached && this.loadedSymbols.has(sym)) {
      this.applyCached(sym, cached);
      this.chartLoading = false;
      this.chartReady = true;
    } else if (fromUserClick) {
      this.chartLoading = true;
      this.chartReady = false;
      this.candles = [];
      this.indicators = null;
    }

    this.waitForSymbolReady(sym, cached).pipe(
      takeUntil(this.destroy$),
      catchError(() => {
        this.setSymbolError(sym, 'Unable to load market data');
        this.finishSymbolLoad(sym);
        if (rollbackOnFail) {
          this.tradingSymbolService.deleteSymbol(sym).subscribe({ error: () => {} });
        }
        return EMPTY;
      })
    ).subscribe({
      next: data => {
        if (data) {
          if (data.candles.length === 0) {
            this.setSymbolError(sym, 'Unable to load market data');
            if (rollbackOnFail) {
              this.tradingSymbolService.deleteSymbol(sym).subscribe({ error: () => {} });
            }
          } else {
            this.cacheSymbol(sym, data);
            this.applySymbolData(data);
            this.clearSymbolError(sym);
          }
        }
        this.finishSymbolLoad(sym);
      },
      error: () => {
        this.setSymbolError(sym, 'Unable to load market data');
        this.finishSymbolLoad(sym);
      }
    });
  }

  private migrateLegacyCustomSymbols(): void {
    const legacy = this.watchlistStore.consumeLegacyCustomSymbols();
    for (const sym of legacy) {
      this.tradingSymbolService.createSymbol({
        symbol: sym,
        groupName: 'Momentum',
        scanEnabled: true,
        subscribeLive: true,
        preloadOnStartup: true,
        enabled: true
      }).subscribe({ error: () => {} });
    }
  }

  private refreshWatchlistFromApi(enrich = false): void {
    const load$ = enrich
      ? this.enrichQueue.loadBaseSymbols()
      : this.enrichQueue.loadBaseSymbols();
    load$.pipe(takeUntil(this.destroy$)).subscribe({
      next: list => {
        this.apiSymbols = list;
        this.watchlist = list;
        this.syncWatchlistSymbolNames();
        if (enrich) {
          this.enrichQueue.schedule(
            list.map(s => s.symbol),
            [this.selectedSymbol]
          );
        }
        this.refreshWorkflowViews();
        this.cdr.markForCheck();
      },
      error: err => console.error('Watchlist load failed', err)
    });
  }

  private finishSymbolLoad(sym: string): void {
    this.setSymbolLoading(sym, false);
    this.searchLoading = false;
    this.chartLoading = false;
    this.chartReady = true;
  }

  private waitForSymbolReady(symbol: string, cached: SymbolCacheEntry | undefined) {
    return this.symbolService.subscribe(symbol).pipe(
      switchMap(sub => {
        this.loadingMessage = sub.message || 'Loading historical data...';
        if (sub.status === 'READY') {
          if (sub.cached && cached) return of(cached);
          return this.loadSymbolData(symbol);
        }
        return this.pollUntilReady(symbol, cached);
      })
    );
  }

  private pollUntilReady(symbol: string, cached: SymbolCacheEntry | undefined): Observable<SymbolCacheEntry> {
    return timer(1000).pipe(
      switchMap(() => this.symbolService.subscribe(symbol)),
      switchMap((sub: SymbolSubscribeResponse) => {
        this.loadingMessage = sub.message || 'Loading historical data...';
        if (sub.status === 'READY') {
          return sub.cached && cached ? of(cached) : this.loadSymbolData(symbol);
        }
        return this.pollUntilReady(symbol, cached);
      })
    );
  }

  private applyCached(symbol: string, cached: SymbolCacheEntry): void {
    this.liveCandles = cached.candles;
    this.liveIndicators = cached.indicators;
    this.liveSignals = cached.signals;
    if (this.chartMode === 'LIVE') {
      this.candles = cached.candles;
      this.indicators = cached.indicators;
      this.signals = cached.signals;
    }
    this.updateTrend();
    this.updateLivePrice();
  }

  private cacheSymbol(symbol: string, data: SymbolCacheEntry): void {
    this.symbolCache.set(symbol, data);
    this.loadedSymbols.add(symbol);
  }

  private loadSymbolData(symbol: string) {
    return forkJoin({
      candles: this.candleService.getLatest(symbol),
      indicators: this.indicatorService.getLatest(symbol),
      signals: this.signalService.getLatest(symbol)
    });
  }

  private refreshActiveSymbol() {
    const sym = this.selectedSymbol;
    return this.loadSymbolData(sym).pipe(tap(data => this.cacheSymbol(sym, data)));
  }

  private applySymbolData(data: SymbolCacheEntry): void {
    this.liveCandles = data.candles;
    this.liveIndicators = data.indicators;
    this.liveSignals = data.signals;
    if (this.chartMode === 'LIVE') {
      this.candles = data.candles;
      this.indicators = data.indicators;
      this.signals = data.signals;
      this.applyDisplayCandles();
      this.updateTrend();
    }
    this.updateLivePrice();
    this.dashboardOrchestrator.requestSymbolContextRefresh();
    this.signalIntelligence.evaluateOpenSignals(this.selectedSymbol, data.candles);
  }

  private updateActiveSignals(active: ActiveSignal[]): void {
    const newHighConf: string[] = [];
    for (const s of active) {
      const key = `${s.symbol}-${s.signalType}-${s.timestamp}`;
      const isNew = !this.knownActiveKeys.has(key);
      const isHighConf = (s.confidenceScore ?? 0) >= 4
        && (s.lifecycleState === 'NEW' || s.lifecycleState === 'ACTIVE');
      if (isNew && isHighConf && !this.alertedHighConfKeys.has(key)) {
        newHighConf.push(key);
        this.alertedHighConfKeys.add(key);
      }
    }
    if (newHighConf.length > 0 && this.knownActiveKeys.size > 0) {
      this.playSignalSound();
    }
    this.knownActiveKeys = new Set(active.map(s => `${s.symbol}-${s.signalType}-${s.timestamp}`));
    this.activeSignals = active;
    if (this.chartMode === 'LIVE') {
      this.signalIntelligence.ingestActiveSignals(active, {
        marketRegime: this.marketTrend?.regime,
        intensityMode: this.intensity.mode,
        timeframe: '5MIN'
      });
    }
  }

  private playSignalSound(): void {
    try {
      if (!this.audioCtx) this.audioCtx = new AudioContext();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.04;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);
      osc.stop(this.audioCtx.currentTime + 0.15);
    } catch { /* ignore */ }
  }

  private updateLivePrice(): void {
    const wl = this.watchlist.find(w => w.symbol === this.selectedSymbol);
    if (wl?.price != null) {
      this.livePrice = wl.price;
    } else if (this.status?.livePrice != null && this.status.symbol === this.selectedSymbol) {
      this.livePrice = this.status.livePrice;
    } else if (this.candles.length > 0) {
      this.livePrice = this.candles[this.candles.length - 1].close;
    }
  }

  private updateTrend(): void {
    if (!this.indicators) {
      this.trendLabel = '—';
      this.trendShade = 'neutral';
      return;
    }
    const { ema9, ema20, ema50, macd, signalLine } = this.indicators;
    if (ema9 > ema20 && ema20 > ema50) this.trendShade = 'bullish';
    else if (ema9 < ema20 && ema20 < ema50) this.trendShade = 'bearish';
    else this.trendShade = 'neutral';

    if (ema9 > ema20 && macd > signalLine) this.trendLabel = 'Bullish Participation';
    else if (ema9 < ema20) this.trendLabel = 'Bearish';
    else this.trendLabel = 'Neutral';
  }

  private setSymbolLoading(sym: string, loading: boolean): void {
    if (loading) {
      if (!this.loadingSymbols.includes(sym)) {
        this.loadingSymbols = [...this.loadingSymbols, sym];
      }
    } else {
      this.loadingSymbols = this.loadingSymbols.filter(s => s !== sym);
    }
  }

  private setSymbolError(sym: string, message: string): void {
    this.symbolErrors = { ...this.symbolErrors, [sym]: message };
  }

  private clearSymbolError(sym: string): void {
    if (this.symbolErrors[sym]) {
      const next = { ...this.symbolErrors };
      delete next[sym];
      this.symbolErrors = next;
    }
  }
}
