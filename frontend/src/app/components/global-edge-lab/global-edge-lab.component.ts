import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BulkHistoryHydrationService } from '../../ai/services/hydration/bulk-history-hydration.service';
import { SymbolHistoryHydrationStore } from '../../ai/services/hydration/symbol-history-hydration.store';
import {
  BulkHydrationProgress,
  HydrationLabRow
} from '../../ai/services/hydration/symbol-history-hydration.models';
import { hydrationStatusLabel } from '../../ai/services/hydration/symbol-history-hydration.store';
import { SymbolAnalysisQueueService } from '../../ai/services/symbol-analysis-queue.service';
import { DailyEdgeDiscoveryReport, HeatmapCell } from '../../services/signal-intelligence/edge-discovery/edge-discovery.models';
import { DailyEdgeDiscoveryReportService } from '../../services/signal-intelligence/edge-discovery/daily-edge-discovery-report.service';
import { WinnerDecompositionReport } from '../../services/signal-intelligence/winner-decomposition/winner-decomposition.models';
import { WinnerDecompositionSynthesisService } from '../../services/signal-intelligence/winner-decomposition/winner-decomposition-synthesis.service';
import { ContinuationPromotionReport } from '../../services/signal-intelligence/continuation-promotion/continuation-promotion.models';
import { ContinuationPromotionSynthesisService } from '../../services/signal-intelligence/continuation-promotion/continuation-promotion-synthesis.service';
import { OpeningExpansionReport } from '../../services/signal-intelligence/opening-expansion/opening-expansion.models';
import { ExpansionParticipationSynthesisService } from '../../services/signal-intelligence/opening-expansion/expansion-participation-synthesis.service';
import { ContinuationParticipationSynthesisService } from '../../services/signal-intelligence/continuation-participation/continuation-participation-synthesis.service';
import { AutonomousExecutionSynthesisService } from '../../services/signal-intelligence/autonomous-execution/autonomous-execution-synthesis.service';
import { RobustnessValidationSynthesisService } from '../../services/signal-intelligence/robustness-validation/robustness-validation-synthesis.service';
import { LiveRegimeSynthesisService } from '../../services/live-regime-intelligence/live-regime-synthesis.service';
import { ExecutionTriggerSynthesisService } from '../../services/execution-trigger-intelligence/execution-trigger-synthesis.service';
import { ExecutionModeService, ExecutionFrameworkMode } from '../../services/signal-intelligence/execution-mode.service';
import { SIGNAL_INTELLIGENCE_LOOKBACK_DAYS } from '../../models/signal-intelligence.model';
import {
  AUTONOMOUS_OPPORTUNITY_TYPES,
  formatAutonomousOpportunityType
} from '../../utils/autonomous-terminology.util';
import { AutonomousOpportunityType } from '../../services/autonomous-regime-scanner/autonomous-regime-scanner.models';
import { TradingSymbolService } from '../../services/trading-symbol.service';
import { IntelligenceOffloadService } from '../../services/intelligence-offload/intelligence-offload.service';
import { AutonomousScannerPanelComponent } from '../autonomous-scanner-panel/autonomous-scanner-panel.component';
import { LiveExecutionFeedComponent } from '../live-execution-feed/live-execution-feed.component';
import { StrategyMemoryPanelComponent } from '../strategy-memory-panel/strategy-memory-panel.component';

export type EdgeLabTab =
  | 'scanner'
  | 'execution'
  | 'feed'
  | 'memory'
  | 'replay'
  | 'discovery'
  | 'robustness'
  | 'governance'
  | 'research'
  | 'winners'
  | 'regime';

/** Phase 136 — Global Edge Lab: market-wide edge discovery across ALL symbols. */
@Component({
  selector: 'app-global-edge-lab',
  standalone: true,
  imports: [CommonModule, AutonomousScannerPanelComponent, LiveExecutionFeedComponent, StrategyMemoryPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './global-edge-lab.component.html',
  styleUrl: './global-edge-lab.component.scss'
})
export class GlobalEdgeLabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() watchlist: string[] = [];
  @Input() initialTab: EdgeLabTab | null = null;
  @Input() focusSymbol: string | null = null;
  @Output() openSymbolDna = new EventEmitter<string>();

  report: DailyEdgeDiscoveryReport | null = null;
  winnerReport: WinnerDecompositionReport | null = null;
  continuationReport: ContinuationPromotionReport | null = null;
  openingExpansionReport: OpeningExpansionReport | null = null;
  continuationParticipationReport: import('../../services/signal-intelligence/continuation-participation/continuation-participation.models').ContinuationParticipationReport | null = null;
  autonomousExecutionReport: import('../../services/signal-intelligence/autonomous-execution/autonomous-execution.models').AutonomousExecutionReport | null = null;
  robustnessReport: import('../../services/signal-intelligence/robustness-validation/robustness-validation.models').RobustnessValidationReport | null = null;
  liveRegimeReport: import('../../services/live-regime-intelligence/live-regime.models').LiveRegimeReport | null = null;
  executionTriggerReport: import('../../services/execution-trigger-intelligence/execution-trigger.models').ExecutionTriggerReport | null = null;
  executionMode: ExecutionFrameworkMode = 'AUTONOMOUS_DISCOVERY';
  loading = false;
  bulkHydrating = false;
  bulkRunning = false;
  symbolsLoading = false;
  autoAnalyzeAfterLoad = true;
  hydrationProgress: BulkHydrationProgress | null = null;
  hydrationRows: HydrationLabRow[] = [];
  bulkSymbols: string[] = [];
  queueDepth = 0;
  activeTab: EdgeLabTab = 'scanner';
  readonly lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;

  readonly labTabs: { id: EdgeLabTab; label: string }[] = [
    { id: 'scanner', label: 'Live Scanner' },
    { id: 'feed', label: 'Execution Feed' },
    { id: 'execution', label: 'Execution Cards' },
    { id: 'memory', label: 'Strategy Memory' },
    { id: 'replay', label: 'Replay Review' },
    { id: 'discovery', label: 'Autonomous Discovery' },
    { id: 'robustness', label: 'Robustness' },
    { id: 'governance', label: 'Governance' },
    { id: 'research', label: 'Strategy Research' },
    { id: 'winners', label: 'Historical Winners' },
    { id: 'regime', label: 'Regime Analytics' }
  ];

  readonly matrixSetups = AUTONOMOUS_OPPORTUNITY_TYPES;
  readonly regimeDims = ['TREND', 'CHOP', 'BREAKOUT', 'CALM', 'EXITING'];
  readonly rvolDims = ['<1.5', '1.5–3', '3–5', '>5'];
  readonly timeDims = ['9:30–9:45', '9:45–10:15', '10:15–11:00', '11:00+'];
  readonly breadthDims = ['WEAK', 'MID', 'STRONG'];

  private sub?: Subscription;
  private winnerSub?: Subscription;
  private continuationSub?: Subscription;
  private openingExpansionSub?: Subscription;
  private participationSub?: Subscription;
  private autonomousSub?: Subscription;
  private robustnessSub?: Subscription;
  private liveRegimeSub?: Subscription;
  private triggerSub?: Subscription;
  private modeSub?: Subscription;
  private hydrationSub?: Subscription;
  private hydrationStoreSub?: Subscription;
  private queueSub?: Subscription;

  constructor(
    private reportService: DailyEdgeDiscoveryReportService,
    private winnerDecomposition: WinnerDecompositionSynthesisService,
    private continuationPromotion: ContinuationPromotionSynthesisService,
    private openingExpansion: ExpansionParticipationSynthesisService,
    private continuationParticipation: ContinuationParticipationSynthesisService,
    private autonomousExecution: AutonomousExecutionSynthesisService,
    private robustnessValidation: RobustnessValidationSynthesisService,
    private liveRegime: LiveRegimeSynthesisService,
    private executionTrigger: ExecutionTriggerSynthesisService,
    private executionModeService: ExecutionModeService,
    private bulkHydration: BulkHistoryHydrationService,
    private hydrationStore: SymbolHistoryHydrationStore,
    private queueService: SymbolAnalysisQueueService,
    private tradingSymbolService: TradingSymbolService,
    private intelligenceOffload: IntelligenceOffloadService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.report = this.reportService.snapshot();
    this.winnerReport = this.winnerDecomposition.snapshot();
    this.continuationReport = this.continuationPromotion.snapshot();
    this.openingExpansionReport = this.openingExpansion.snapshot();
    this.continuationParticipationReport = this.continuationParticipation.snapshot();
    this.autonomousExecutionReport = this.autonomousExecution.snapshot();
    this.robustnessReport = this.robustnessValidation.snapshot();
    this.liveRegimeReport = this.liveRegime.snapshot();
    this.executionTriggerReport = this.executionTrigger.snapshot();
    this.executionMode = this.executionModeService.mode();
    this.sub = this.reportService.report$.subscribe(r => {
      this.report = r;
      this.cdr.markForCheck();
    });
    this.winnerSub = this.winnerDecomposition.report$.subscribe(r => {
      this.winnerReport = r;
      this.cdr.markForCheck();
    });
    this.continuationSub = this.continuationPromotion.report$.subscribe(r => {
      this.continuationReport = r;
      this.cdr.markForCheck();
    });
    this.openingExpansionSub = this.openingExpansion.report$.subscribe(r => {
      this.openingExpansionReport = r;
      this.cdr.markForCheck();
    });
    this.participationSub = this.continuationParticipation.report$.subscribe(r => {
      this.continuationParticipationReport = r;
      this.cdr.markForCheck();
    });
    this.autonomousSub = this.autonomousExecution.report$.subscribe(r => {
      this.autonomousExecutionReport = r;
      this.cdr.markForCheck();
    });
    this.robustnessSub = this.robustnessValidation.report$.subscribe(r => {
      this.robustnessReport = r;
      this.cdr.markForCheck();
    });
    this.liveRegimeSub = this.liveRegime.report$.subscribe(r => {
      this.liveRegimeReport = r;
      this.cdr.markForCheck();
    });
    this.triggerSub = this.executionTrigger.report$.subscribe(r => {
      this.executionTriggerReport = r;
      this.cdr.markForCheck();
    });
    this.modeSub = this.executionModeService.mode$.subscribe(m => {
      this.executionMode = m;
      this.cdr.markForCheck();
    });
    this.hydrationSub = this.bulkHydration.progress$.subscribe(p => {
      this.hydrationProgress = p;
      this.bulkHydrating = p.running;
      this.refreshHydrationRows();
      this.cdr.markForCheck();
    });
    this.hydrationStoreSub = this.hydrationStore.revision$.subscribe(() => this.refreshHydrationRows());
    this.queueSub = this.queueService.statusMap$.subscribe(() => {
      this.queueDepth = this.queueService.queueLength();
      this.bulkRunning = this.queueDepth > 0;
      this.cdr.markForCheck();
    });
    this.hydrationProgress = this.bulkHydration.snapshot();
    void this.resolveBulkSymbols();
    this.winnerReport = this.winnerDecomposition.refresh(this.lookbackDays, {});
    this.liveRegimeReport = this.liveRegime.refresh(this.lookbackDays, {});
    this.robustnessReport = this.robustnessValidation.refresh(this.lookbackDays, {});
    this.continuationReport = this.continuationPromotion.refresh(this.lookbackDays, {});
    this.openingExpansionReport = this.openingExpansion.refresh(this.lookbackDays, {});
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['watchlist']) {
      this.syncBulkSymbolsFromInput();
      this.refreshHydrationRows();
    }
    if (changes['initialTab'] && this.initialTab) {
      this.activeTab = this.initialTab;
      this.refreshActiveTab();
    }
    if (changes['focusSymbol'] && this.focusSymbol) {
      this.refreshActiveTab();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.winnerSub?.unsubscribe();
    this.continuationSub?.unsubscribe();
    this.openingExpansionSub?.unsubscribe();
    this.participationSub?.unsubscribe();
    this.autonomousSub?.unsubscribe();
    this.robustnessSub?.unsubscribe();
    this.liveRegimeSub?.unsubscribe();
    this.triggerSub?.unsubscribe();
    this.modeSub?.unsubscribe();
    this.hydrationSub?.unsubscribe();
    this.hydrationStoreSub?.unsubscribe();
    this.queueSub?.unsubscribe();
  }

  setExecutionMode(mode: ExecutionFrameworkMode): void {
    this.executionModeService.setMode(mode);
  }

  selectTab(tab: EdgeLabTab): void {
    this.activeTab = tab;
    this.refreshActiveTab();
    this.cdr.markForCheck();
  }

  onScannerSymbol(symbol: string): void {
    this.openSymbolDna.emit(symbol);
  }

  onMemoryReplay(symbol: string): void {
    this.focusSymbol = symbol;
    this.activeTab = 'replay';
    this.cdr.markForCheck();
  }

  showSection(section: 'hydration' | 'research' | 'winners' | 'discovery' | 'robustness' | 'regime' | 'execution' | 'governance' | 'feed' | 'memory'): boolean {
    switch (this.activeTab) {
      case 'feed': return section === 'feed';
      case 'memory': return section === 'memory';
      case 'replay': return section === 'hydration';
      case 'execution': return section === 'execution';
      case 'discovery': return section === 'discovery';
      case 'robustness': return section === 'robustness';
      case 'regime': return section === 'regime';
      case 'winners': return section === 'winners';
      case 'governance': return section === 'governance';
      case 'research': return section === 'research' || section === 'governance';
      default: return false;
    }
  }

  private refreshActiveTab(): void {
    switch (this.activeTab) {
      case 'scanner':
      case 'feed':
      case 'memory':
        break;
      case 'execution':
        this.executionTriggerReport = this.executionTrigger.refresh(this.lookbackDays, this.focusFilter());
        break;
      case 'regime':
        this.liveRegimeReport = this.liveRegime.refresh(this.lookbackDays, {});
        break;
      case 'robustness':
        this.robustnessReport = this.robustnessValidation.refresh(this.lookbackDays, {});
        break;
      case 'discovery':
        this.autonomousExecutionReport = this.autonomousExecution.refresh();
        this.continuationParticipationReport = this.continuationParticipation.refresh();
        break;
      case 'winners':
        this.winnerReport = this.winnerDecomposition.refresh(this.lookbackDays, {});
        break;
      case 'research':
      case 'replay':
        this.report = this.reportService.refresh();
        break;
      case 'governance':
        this.report = this.reportService.refresh();
        this.continuationReport = this.continuationPromotion.refresh(this.lookbackDays, {});
        this.openingExpansionReport = this.openingExpansion.refresh(this.lookbackDays, {});
        break;
    }
  }

  private focusFilter(): { symbol: string } | {} {
    const sym = this.focusSymbol ?? this.bulkSymbols[0] ?? this.watchlist[0];
    return sym ? { symbol: sym.toUpperCase() } : {};
  }

  refresh(): void {
    this.loading = true;
    this.report = this.reportService.refresh();
    this.winnerReport = this.winnerDecomposition.refresh();
    this.continuationReport = this.continuationPromotion.refresh();
    this.openingExpansionReport = this.openingExpansion.refresh();
    this.continuationParticipationReport = this.continuationParticipation.refresh();
    this.autonomousExecutionReport = this.autonomousExecution.refresh();
    this.robustnessReport = this.robustnessValidation.refresh(this.lookbackDays, {});
    this.continuationReport = this.continuationPromotion.refresh(this.lookbackDays, {});
    this.openingExpansionReport = this.openingExpansion.refresh(this.lookbackDays, {});
    const focusSymbol = this.bulkSymbols[0] ?? this.watchlist[0];
    if (this.intelligenceOffload.isEnabled() && focusSymbol) {
      this.intelligenceOffload.prefetchForSymbol(focusSymbol);
      this.liveRegimeReport = this.liveRegime.refresh(this.lookbackDays, { symbol: focusSymbol });
      this.executionTriggerReport = this.executionTrigger.refresh(this.lookbackDays, { symbol: focusSymbol });
    } else {
      this.liveRegimeReport = this.liveRegime.refresh();
      this.executionTriggerReport = this.executionTrigger.refresh();
    }
    this.loading = false;
    this.cdr.markForCheck();
    void this.refreshAi();
  }

  loadAllHistory(): void {
    if (this.bulkHydrating || this.bulkRunning || !this.bulkSymbols.length) return;
    this.bulkHydrating = true;
    this.bulkHydration.startBulkHydration(this.bulkSymbols, {
      lookbackDays: this.lookbackDays,
      autoAnalyze: this.autoAnalyzeAfterLoad
    });
    this.cdr.markForCheck();
  }

  analyzeWatchlist(): void {
    if (this.bulkRunning || this.bulkHydrating || !this.bulkSymbols.length) return;
    this.queueService.enqueueWatchlist(this.bulkSymbols);
    this.cdr.markForCheck();
  }

  retryHydration(symbol: string): void {
    this.bulkHydration.retrySymbol(symbol, this.lookbackDays);
  }

  toggleAutoAnalyze(): void {
    this.autoAnalyzeAfterLoad = !this.autoAnalyzeAfterLoad;
    this.cdr.markForCheck();
  }

  goToSymbolDna(symbol: string): void {
    this.openSymbolDna.emit(symbol);
  }

  formatEta(ms: number | null | undefined): string {
    if (ms == null || ms <= 0) return '—';
    const min = Math.ceil(ms / 60_000);
    return min < 2 ? '~1 min' : `~${min} min`;
  }

  formatScore(v: number | undefined | null): string {
    return v == null ? '—' : String(Math.round(v));
  }

  hydrationStatusLabel(status: string): string {
    return hydrationStatusLabel(status as import('../../ai/services/hydration/symbol-history-hydration.models').HydrationStatus);
  }

  private async refreshAi(): Promise<void> {
    const base = this.report;
    if (!base || base.discovery.totalEvaluated < 10) return;
    this.report = await this.reportService.refreshWithAi(base.lookbackDays);
    this.cdr.markForCheck();
  }

  private refreshHydrationRows(): void {
    if (!this.bulkSymbols.length) {
      this.hydrationRows = [];
      this.cdr.markForCheck();
      return;
    }
    this.hydrationRows = this.bulkHydration.buildLabRows(this.bulkSymbols);
    this.cdr.markForCheck();
  }

  private syncBulkSymbolsFromInput(): void {
    if (this.watchlist?.length) {
      this.bulkSymbols = [...new Set(this.watchlist.map(s => s.toUpperCase()))];
    }
  }

  private async resolveBulkSymbols(): Promise<void> {
    this.syncBulkSymbolsFromInput();
    if (this.bulkSymbols.length) {
      this.refreshHydrationRows();
      return;
    }

    this.symbolsLoading = true;
    this.cdr.markForCheck();
    try {
      const list = await firstValueFrom(
        this.tradingSymbolService.getSymbols(true).pipe(catchError(() => of([])))
      );
      this.bulkSymbols = list
        .filter(s => s.enabled !== false)
        .map(s => s.symbol.toUpperCase());
    } finally {
      this.symbolsLoading = false;
      this.refreshHydrationRows();
      this.cdr.markForCheck();
    }
  }

  heatCell(cells: HeatmapCell[], setup: AutonomousOpportunityType, dim: string): HeatmapCell | undefined {
    return cells.find(c => c.setup === setup && c.dimension === dim);
  }

  formatR(v: number): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
  }

  formatPct(v: number): string {
    return `${v}%`;
  }

  confidenceClass(tier: string): string {
    return tier.toLowerCase();
  }

  formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' });
  }

  formatLabel(value: string): string {
    return formatAutonomousOpportunityType(value);
  }

  capitalClass(rank: string): string {
    return rank.toLowerCase();
  }

  robustnessClass(classification: string): string {
    return classification.toLowerCase().replace(/_/g, '-');
  }

  outlierDependentRows(report: import('../../services/signal-intelligence/robustness-validation/robustness-validation.models').RobustnessValidationReport) {
    return report.outlierAnalysis.filter(o => o.outlierDependent).slice(0, 6);
  }

  generalizingRows(report: import('../../services/signal-intelligence/robustness-validation/robustness-validation.models').RobustnessValidationReport) {
    return report.generalizationMetrics.filter(g => g.generalizes).slice(0, 6);
  }

  stableContinuationRows(report: import('../../services/signal-intelligence/robustness-validation/robustness-validation.models').RobustnessValidationReport) {
    return report.continuationPersistenceStability.filter(c => c.stable).slice(0, 6);
  }
}
