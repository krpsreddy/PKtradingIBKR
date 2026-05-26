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
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { SymbolEdgeAnalysisService } from '../../ai/services/symbol-edge-analysis.service';
import { SymbolAnalysisQueueService } from '../../ai/services/symbol-analysis-queue.service';
import { SymbolEdgeProfileStore } from '../../ai/services/symbol-edge-profile.store';
import { SymbolDnaEngine } from '../../ai/symbol-dna.engine';
import { SymbolDnaProfile } from '../../ai/models/symbol-dna.models';
import {
  SymbolAnalysisStatus,
  SymbolEdgeAnalysisResponse,
  SymbolEdgeCompressedSummary,
  SymbolEdgeProfile,
  SymbolEdgeRankingRow
} from '../../ai/models/symbol-edge.models';
import { SignalIntelligenceStore } from '../../services/signal-intelligence/signal-intelligence.store';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SetupRegimeMatrixSnapshot,
  SetupRegimePivotCell,
  IntelligenceSignalType,
  MarketRegime
} from '../../models/signal-intelligence.model';
import { ExecutionAdvisoryAnalyticsService } from '../../services/signal-intelligence/execution-advisory-analytics.service';

/** Phase 136 — Symbol DNA: per-symbol execution refinement (not global edge). */
@Component({
  selector: 'app-symbol-dna-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './symbol-dna-panel.component.html',
  styleUrl: './symbol-dna-panel.component.scss'
})
export class SymbolDnaPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input() symbol = 'NVDA';
  @Output() symbolSelect = new EventEmitter<string>();

  loading = false;
  backfilling = false;
  backfillMessage: string | null = null;
  analysis: SymbolEdgeAnalysisResponse | null = null;
  deterministic: SymbolEdgeCompressedSummary | null = null;
  profile: SymbolEdgeProfile | null = null;
  dna: SymbolDnaProfile | null = null;
  rankings: SymbolEdgeRankingRow[] = [];
  analysisStatus: SymbolAnalysisStatus = 'IDLE';
  statusMessage: string | null = null;
  lastUpdatedLabel = '—';
  queueDepth = 0;
  matrix: SetupRegimeMatrixSnapshot | null = null;

  readonly matrixSetups: IntelligenceSignalType[] = ['BREAKOUT', 'VWAP_RECLAIM', 'TREND_CONTINUATION', 'REVERSAL', 'MOMENTUM'];
  readonly matrixRegimes: MarketRegime[] = ['TREND', 'CHOP', 'BREAKOUT', 'CALM', 'EXITING'];
  readonly lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;

  private readonly dnaEngine = new SymbolDnaEngine();
  private storeSub?: Subscription;
  private revisionSub?: Subscription;
  private profileSub?: Subscription;
  private queueSub?: Subscription;
  private readonly storeRevision$ = new Subject<void>();
  private aiRequestId = 0;
  private initialized = false;

  constructor(
    private edgeService: SymbolEdgeAnalysisService,
    private queueService: SymbolAnalysisQueueService,
    private profileStore: SymbolEdgeProfileStore,
    private store: SignalIntelligenceStore,
    private advisoryService: ExecutionAdvisoryAnalyticsService,
    private cdr: ChangeDetectorRef
  ) {
    this.storeSub = this.storeRevision$.pipe(debounceTime(400)).subscribe(() => this.refreshDeterministicOnly());
    this.revisionSub = this.store.revision$.subscribe(() => {
      this.storeRevision$.next();
      this.refreshMatrix();
    });
  }

  ngOnInit(): void {
    this.profileSub = this.profileStore.revision$.subscribe(() => {
      this.rankings = this.edgeService.getRankings();
      this.syncFromProfile();
      this.cdr.markForCheck();
    });
    this.queueSub = this.queueService.statusMap$.subscribe(() => {
      this.analysisStatus = this.queueService.getStatus(this.activeSymbol);
      this.queueDepth = this.queueService.queueLength();
      this.cdr.markForCheck();
    });
    this.rankings = this.edgeService.getRankings();
    this.initialized = true;
    this.syncFromProfile();
    this.refreshMatrix();
    this.refresh(true);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['symbol']?.currentValue && this.initialized) {
      const next = String(changes['symbol'].currentValue).toUpperCase();
      const prev = changes['symbol'].previousValue ? String(changes['symbol'].previousValue).toUpperCase() : '';
      if (next !== prev) {
        this.backfillMessage = null;
        this.syncFromProfile();
        this.refreshMatrix();
        this.refresh(true);
      }
    }
  }

  ngOnDestroy(): void {
    this.storeSub?.unsubscribe();
    this.revisionSub?.unsubscribe();
    this.profileSub?.unsubscribe();
    this.queueSub?.unsubscribe();
    this.storeRevision$.complete();
  }

  get activeSymbol(): string {
    return (this.symbol || 'NVDA').toUpperCase();
  }

  selectRankingRow(row: SymbolEdgeRankingRow | { symbol: string }): void {
    if (row.symbol !== this.activeSymbol) {
      this.symbolSelect.emit(row.symbol);
    }
  }

  async loadSymbolHistory(): Promise<void> {
    const sym = this.activeSymbol;
    if (this.backfilling || this.queueService.isQueuedOrRunning(sym)) return;
    this.backfilling = true;
    this.analysisStatus = 'LOADING_HISTORY';
    this.backfillMessage = `Loading ${this.lookbackDays}D history for ${sym}…`;
    this.cdr.markForCheck();
    try {
      const result = await this.edgeService.loadHistory(sym, this.lookbackDays);
      this.backfillMessage = result.error ?? (result.recorded > 0
        ? `Loaded ${result.recorded} signals from ${result.sessions} sessions`
        : result.historyMessage || 'History load complete');
      this.analysisStatus = result.error ? 'FAILED' : 'READY';
      this.refresh(true);
    } catch {
      this.backfillMessage = `Backfill failed for ${sym}`;
      this.analysisStatus = 'FAILED';
    } finally {
      this.backfilling = false;
      this.cdr.markForCheck();
    }
  }

  analyzeSymbol(forceRefresh = false): void {
    const sym = this.activeSymbol;
    if (this.queueService.isQueuedOrRunning(sym)) return;
    this.queueService.enqueue(sym, { forceRefresh });
    void this.waitForQueuedAnalysis();
  }

  refresh(runAi = true): void {
    this.refreshDeterministicOnly();
    if (!runAi) return;
    if (this.profile?.analysis && !this.queueService.isQueuedOrRunning(this.activeSymbol)) {
      this.analysis = this.profile.analysis;
      this.deterministic = this.profile.deterministic;
      this.buildDna();
      this.cdr.markForCheck();
      return;
    }
    void this.runAiAnalysis();
  }

  formatPct(v: number | undefined | null): string {
    return v == null ? '—' : `${v}%`;
  }

  formatR(v: number | undefined | null): string {
    return v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
  }

  formatScore(v: number | undefined | null): string {
    return v == null ? '—' : String(Math.round(v));
  }

  statusLabel(status: SymbolAnalysisStatus): string {
    const map: Record<string, string> = {
      QUEUED: 'Queued', LOADING_HISTORY: 'Loading', EVALUATING: 'Evaluating',
      ANALYZING_AI: 'AI analyzing', READY: 'Ready', FAILED: 'Failed'
    };
    return map[status] ?? 'Idle';
  }

  bandClass(band: string): string {
    return band.toLowerCase().replace('_', '-');
  }

  fakeoutClass(t: string): string {
    return t.toLowerCase();
  }

  pivotCell(setup: IntelligenceSignalType, regime: MarketRegime): SetupRegimePivotCell | null {
    return this.matrix?.pivot.find(p => p.setup === setup && p.regime === regime) ?? null;
  }

  private buildDna(): void {
    if (!this.deterministic) {
      this.dna = null;
      return;
    }
    this.dna = this.dnaEngine.build(this.deterministic, this.analysis?.ai?.summary);
  }

  private async waitForQueuedAnalysis(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    while (this.queueService.isQueuedOrRunning(this.activeSymbol) || this.queueService.queueLength() > 0) {
      this.analysisStatus = this.queueService.getStatus(this.activeSymbol);
      await new Promise(r => setTimeout(r, 500));
      this.cdr.markForCheck();
    }
    this.syncFromProfile();
    this.loading = false;
    this.cdr.markForCheck();
  }

  private refreshDeterministicOnly(): void {
    this.deterministic = this.edgeService.buildDeterministicSummary(this.activeSymbol);
    this.buildDna();
    this.cdr.markForCheck();
  }

  private syncFromProfile(): void {
    const sym = this.activeSymbol;
    this.profile = this.edgeService.getProfile(sym) ?? null;
    if (this.profile) {
      this.analysis = this.profile.analysis;
      this.deterministic = this.profile.deterministic;
      this.analysisStatus = this.profile.status;
      this.statusMessage = this.profile.statusMessage ?? null;
      this.lastUpdatedLabel = this.profile.lastUpdated ? new Date(this.profile.lastUpdated).toLocaleString() : '—';
    } else {
      this.deterministic = this.edgeService.buildDeterministicSummary(sym);
      this.analysisStatus = this.queueService.getStatus(sym);
    }
    this.buildDna();
  }

  private async runAiAnalysis(): Promise<void> {
    const sym = this.activeSymbol;
    const requestId = ++this.aiRequestId;
    this.loading = true;
    this.analysisStatus = 'ANALYZING_AI';
    this.cdr.markForCheck();
    try {
      const profile = await this.edgeService.analyzeSymbol(sym);
      if (requestId !== this.aiRequestId) return;
      this.profile = profile;
      this.analysis = profile.analysis;
      this.deterministic = profile.deterministic;
      this.analysisStatus = profile.status;
      this.lastUpdatedLabel = new Date(profile.lastUpdated).toLocaleString();
      this.rankings = this.edgeService.getRankings();
      this.buildDna();
    } catch {
      if (requestId === this.aiRequestId) this.analysisStatus = 'FAILED';
    } finally {
      if (requestId === this.aiRequestId) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  private refreshMatrix(): void {
    this.matrix = this.advisoryService.forSymbol(this.activeSymbol).matrix;
  }
}
