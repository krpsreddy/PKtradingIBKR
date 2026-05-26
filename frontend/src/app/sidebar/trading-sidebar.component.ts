import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { distinctUntilChanged, map, takeUntil } from 'rxjs';
import { ActiveSignal, MarketTrend } from '../models/workspace.model';
import { rowDecayOpacity } from '../utils/information-decay.util';
import { SidebarPeripheralDissolveEngine } from '../services/sidebar-peripheral-dissolve.engine';
import { TradingSymbol } from '../models/trading-symbol.model';
import { MarketPersonality } from '../models/cognition.model';
import { SystemStatus } from '../models/system-status.model';
import { SparklineComponent } from '../components/sparkline/sparkline.component';
import { buildWatchCandidates, WatchCandidate } from '../utils/watch-candidates.util';
import { buildMarketModeRows, MarketModeRow } from '../utils/market-mode.util';
import { SidebarRowOverflowResolver, SidebarRowResolved } from '../services/sidebar-row-overflow.resolver';
import { computeWatchlistPriority } from '../utils/watchlist-priority.util';
import { formatSignalAge } from '../utils/signal-age.util';
import { isValidTicker, rankWatchlistSearch } from '../utils/watchlist-search.util';
import { MarketInternalsComponent } from '../components/market-internals/market-internals.component';
import { LiveOpportunityCardComponent } from '../components/live-opportunity-card/live-opportunity-card.component';
import { TopAutonomousOpportunityCardComponent } from '../components/top-autonomous-opportunity-card/top-autonomous-opportunity-card.component';
import { AutonomousExecutionCardComponent } from '../components/autonomous-execution-card/autonomous-execution-card.component';
import { WorkflowStateService } from '../services/workflow-state.service';
import { computeAttentionScore } from '../utils/attention-score.util';
import { computeSignalHealth, healthFromSymbol } from '../utils/signal-health.util';
import { SetupCandidate } from '../models/execution.model';
import { EmergingSetup } from '../models/refinement.model';
import {
  ScannerOpportunityCard,
  ScannerSnapshot
} from '../services/autonomous-regime-scanner/autonomous-regime-scanner.models';
import { LiveExecutionFeedComponent } from '../components/live-execution-feed/live-execution-feed.component';
import { ExecutionFrameworkMode167 } from '../services/real-time-execution/real-time-execution.models';
import { topAutonomousOpportunity, watchlistRegimeGroups } from '../services/autonomous-regime-scanner/sidebar-regime-groups.engine';
import { actionChipLabel, resolveScannerLiveState } from '../services/autonomous-regime-scanner/scanner-state.engine';
import { RuntimeScanControlService } from '../services/runtime-scan/runtime-scan-control.service';
import { DominantOpportunityService } from '../services/dominant-opportunity/dominant-opportunity.service';
import { DominantOpportunitySnapshot } from '../services/dominant-opportunity/dominant-opportunity.models';
import { NanoPulseService } from '../services/runtime-scan/nano-pulse.service';
import { DominantOpportunityHeroComponent } from '../components/dominant-opportunity-hero/dominant-opportunity-hero.component';

export interface SymbolGroupView {
  name: string;
  items: TradingSymbol[];
  collapsed: boolean;
  regimeGroup?: boolean;
}

@Component({
  selector: 'app-trading-sidebar',
  standalone: true,
  imports: [
    DecimalPipe,
    FormsModule,
    SparklineComponent,
    RouterLink,
    MarketInternalsComponent,
    LiveOpportunityCardComponent,
    TopAutonomousOpportunityCardComponent,
    LiveExecutionFeedComponent,
    DominantOpportunityHeroComponent
  ],
  templateUrl: './trading-sidebar.component.html',
  styleUrl: './trading-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradingSidebarComponent implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  @ViewChild('watchlistContainer') watchlistContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  @Input() set symbols(items: TradingSymbol[]) {
    this._symbols = items ?? [];
    this.applyFilter(this.watchlistSearch.trim().toUpperCase());
  }
  get symbols(): TradingSymbol[] {
    return this._symbols;
  }
  private _symbols: TradingSymbol[] = [];

  @Input() activeSignals: ActiveSignal[] = [];
  @Input() bestSetup!: SetupCandidate;
  @Input() bestSetupWeak = false;
  @Input() emergingSetups: EmergingSetup[] = [];
  @Input() focusMode = false;
  @Input() radarCompact = false;
  @Input() sidebarLift = 0;
  @Input() silenceActive = false;
  @Input() temporalForget = 1;
  @Input() intensityMode: import('../services/situational-intensity.engine').IntensityMode = 'CALM';
  @Input() scannerSnapshot: ScannerSnapshot | null = null;
  @Input() autonomousCards: Record<string, ScannerOpportunityCard> = {};
  @Input() marketTrend: MarketTrend | null = null;
  @Input() marketPersonality: MarketPersonality | null = null;
  @Input() status: SystemStatus | null = null;
  @Input() selectedSymbol = 'NVDA';
  @Input() collapsed = false;
  @Input() mobileOpen = false;
  @Input() loadingSymbols: string[] = [];
  @Input() symbolErrors: Record<string, string> = {};
  @Input() searchLoading = false;
  @Input() executionMode: ExecutionFrameworkMode167 = 'CONFIRMED';
  @Input() topEnriched: import('../services/execution-intelligence/enriched-opportunity.model').EnrichedOpportunity | null = null;

  @Output() symbolSelected = new EventEmitter<string>();
  @Output() symbolAdded = new EventEmitter<string>();
  @Output() symbolRemoved = new EventEmitter<string>();
  @Output() activeSignalSelected = new EventEmitter<string>();
  @Output() executionFocus = new EventEmitter<string>();
  @Output() executionModeChange = new EventEmitter<ExecutionFrameworkMode167>();
  @Output() toggleCollapse = new EventEmitter<void>();
  @Output() closeMobile = new EventEmitter<void>();

  watchlistSearch = '';
  symbolGroups: SymbolGroupView[] = [];
  flatVisibleSymbols: string[] = [];
  highlightIndex = -1;
  flashSymbol: string | null = null;
  private collapsedGroups = new Set<string>();

  emergingPanelOpen = true;
  watchlistPanelOpen = true;
  signalsPanelOpen = true;
  marketPanelOpen = true;
  statusPanelOpen = false;

  scanLabel = 'SCANNING OFF';
  scanTone: 'active' | 'paused' | 'degraded' = 'paused';
  dominantSnapshot: DominantOpportunitySnapshot | null = null;

  private search$ = new BehaviorSubject<string>('');
  private destroy$ = new Subject<void>();
  private prevRising = new Set<string>();

  constructor(
    private workflowState: WorkflowStateService,
    private cdr: ChangeDetectorRef,
    private peripheralDissolve: SidebarPeripheralDissolveEngine,
    private rowOverflow: SidebarRowOverflowResolver,
    private scanControl: RuntimeScanControlService,
    private dominantEngine: DominantOpportunityService,
    private nanoPulse: NanoPulseService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['scannerSnapshot'] || changes['autonomousCards'] || changes['symbols'] || changes['marketTrend']) {
      this.applyFilter(this.watchlistSearch.trim().toUpperCase());
      this.trackRisingSymbols();
      this.refreshDominance();
    }
    if (changes['activeSignals'] || changes['emergingSetups']) {
      this.applyAdaptiveStacking();
    }
  }

  private trackRisingSymbols(): void {
    const rising = new Set(this.scannerSnapshot?.risingSymbols ?? []);
    for (const sym of rising) {
      if (!this.prevRising.has(sym)) {
        this.flashSymbol = sym;
        setTimeout(() => {
          if (this.flashSymbol === sym) this.flashSymbol = null;
          this.cdr.markForCheck();
        }, 2400);
      }
    }
    this.prevRising = rising;
  }

  private applyAdaptiveStacking(): void {
    const noLive = this.activeSignals.length === 0;
    if (noLive) {
      this.signalsPanelOpen = true;
      this.emergingPanelOpen = this.emergingSetups.length > 0 || this.watchCandidates.length > 0;
    }
  }

  ngOnInit(): void {
    this.refreshScanUi();
    this.scanControl.state$.pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshScanUi());
    this.nanoPulse.boosts$.pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshDominance());

    this.refreshDominance();

    const panels = this.workflowState.loadPanelState();
    this.signalsPanelOpen = panels['liveOpportunities'] ?? true;
    this.emergingPanelOpen = panels['emerging'] ?? true;
    this.watchlistPanelOpen = panels['watchlist'] ?? true;
    this.marketPanelOpen = panels['marketInternals'] ?? true;
    this.statusPanelOpen = panels['marketStatus'] ?? false;
    this.search$.pipe(
      map(q => q.trim().toUpperCase()),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(q => this.applyFilter(q));
  }

  ngAfterViewInit(): void {
    this.emitSearch('');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get topOpportunity(): ScannerOpportunityCard | null {
    const dom = this.dominantSnapshot?.dominant?.card;
    if (dom) return dom;
    if (this.topEnriched) {
      const e = this.topEnriched;
      return this.autonomousCards[e.symbol] ?? {
        symbol: e.symbol,
        opportunityType: e.opportunityType as ScannerOpportunityCard['opportunityType'],
        action: e.primaryAction.primaryAction as ScannerOpportunityCard['action'],
        tone: e.tone,
        badge: e.badge,
        convictionScore: e.convictionScore,
        expansionProbability: 0,
        continuationPersistence: e.persistenceScore,
        triggerIntegrity: 0,
        institutionalPressure: 0,
        exhaustionProbability: 0,
        executionQuality: 0,
        entryZoneLabel: e.entryZoneLabel,
        riskLabel: e.riskLabel,
        whyNow: e.whyNow,
        windowLabel: '',
        rvolLabel: '',
        popVelocity: e.popVelocity,
        isRising: e.isRising,
        rank: e.rank,
        executionPlan: e.executionPlan ?? undefined
      };
    }
    return topAutonomousOpportunity(this.scannerSnapshot);
  }

  onExecutionModeChange(mode: ExecutionFrameworkMode167): void {
    this.executionModeChange.emit(mode);
  }

  onFeedSymbolSelect(symbol: string): void {
    this.selectRegimeSymbol(symbol);
  }

  onSearchInput(value: string): void {
    this.watchlistSearch = value.toUpperCase();
    this.highlightIndex = -1;
    this.emitSearch(this.watchlistSearch);
  }

  clearSearch(): void {
    this.watchlistSearch = '';
    this.highlightIndex = -1;
    this.emitSearch('');
    this.searchInput?.nativeElement.focus();
  }

  private emitSearch(q: string): void {
    this.search$.next(q);
  }

  private applyFilter(query: string): void {
    const enabled = this._symbols.filter(s => s.enabled);
    const filtered = rankWatchlistSearch(enabled, query);

    if (this.scannerSnapshot && !query) {
      const regimeBuckets = watchlistRegimeGroups(this.scannerSnapshot, enabled.map(s => s.symbol));
      const symMap = new Map(enabled.map(s => [s.symbol, s]));
      const assigned = new Set<string>();
      const regimeViews: SymbolGroupView[] = [];

      for (const bucket of regimeBuckets) {
        const items = bucket.symbols.map(sym => symMap.get(sym)).filter((s): s is TradingSymbol => !!s);
        for (const i of items) assigned.add(i.symbol);
        if (items.length) {
          regimeViews.push({
            name: bucket.label,
            items,
            collapsed: this.collapsedGroups.has(bucket.label),
            regimeGroup: true
          });
        }
      }

      const remainder = filtered.filter(s => !assigned.has(s.symbol));
      if (remainder.length) {
        regimeViews.push({
          name: 'Other',
          items: remainder,
          collapsed: this.collapsedGroups.has('Other'),
          regimeGroup: true
        });
      }

      this.symbolGroups = regimeViews;
    } else {
      const byGroup = new Map<string, TradingSymbol[]>();
      for (const item of filtered) {
        const group = item.groupName || 'Other';
        if (!byGroup.has(group)) byGroup.set(group, []);
        byGroup.get(group)!.push(item);
      }
      const groupOrder = ['AI', 'Semis', 'Software', 'EV', 'Watch Closely', 'ETFs', 'Swing', 'Other'];
      const names = [...new Set([...groupOrder, ...byGroup.keys()])].filter(g => byGroup.has(g));
      this.symbolGroups = names.map(name => ({
        name,
        items: byGroup.get(name) ?? [],
        collapsed: this.collapsedGroups.has(name)
      }));
    }

    this.flatVisibleSymbols = filtered.map(s => s.symbol);
    if (this.canLoadNewSymbol()) {
      this.flatVisibleSymbols.push('__LOAD__');
    }
  }

  toggleGroup(name: string): void {
    if (this.collapsedGroups.has(name)) {
      this.collapsedGroups.delete(name);
    } else {
      this.collapsedGroups.add(name);
    }
    this.applyFilter(this.watchlistSearch.trim().toUpperCase());
  }

  groupCount(name: string): number {
    return this.symbolGroups.find(g => g.name === name)?.items.length ?? 0;
  }

  canLoadNewSymbol(): boolean {
    const q = this.watchlistSearch.trim().toUpperCase();
    if (!isValidTicker(q)) return false;
    return !this._symbols.some(w => w.symbol.toUpperCase() === q);
  }

  loadSearchedSymbol(): void {
    const sym = this.watchlistSearch.trim().toUpperCase();
    if (!isValidTicker(sym)) return;
    this.symbolAdded.emit(sym);
    this.watchlistSearch = '';
    this.highlightIndex = -1;
    this.emitSearch('');
  }

  selectSymbol(symbol: string): void {
    this.symbolSelected.emit(symbol);
    this.closeMobile.emit();
  }

  selectRegimeSymbol(symbol: string): void {
    this.symbolSelected.emit(symbol);
    this.executionFocus.emit(symbol);
    this.closeMobile.emit();
  }

  removeSymbol(symbol: string, event: MouseEvent): void {
    event.stopPropagation();
    this.symbolRemoved.emit(symbol.toUpperCase());
  }

  selectActiveSignal(symbol: string): void {
    this.activeSignalSelected.emit(symbol);
    this.executionFocus.emit(symbol);
    this.closeMobile.emit();
  }

  isLoading(symbol: string): boolean {
    return this.loadingSymbols.includes(symbol.toUpperCase());
  }

  getError(symbol: string): string | null {
    return this.symbolErrors[symbol.toUpperCase()] ?? null;
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.clearSearch();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.flatVisibleSymbols.length === 0) return;
      this.highlightIndex = Math.min(this.highlightIndex + 1, this.flatVisibleSymbols.length - 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.flatVisibleSymbols.length === 0) return;
      this.highlightIndex = Math.max(this.highlightIndex - 1, 0);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.highlightIndex >= 0 && this.highlightIndex < this.flatVisibleSymbols.length) {
        const target = this.flatVisibleSymbols[this.highlightIndex];
        if (target === '__LOAD__') {
          this.loadSearchedSymbol();
        } else {
          this.selectSymbol(target);
          this.clearSearch();
        }
        return;
      }
      if (this.flatVisibleSymbols.length === 1 && this.flatVisibleSymbols[0] !== '__LOAD__') {
        this.selectSymbol(this.flatVisibleSymbols[0]);
        this.clearSearch();
      } else if (this.canLoadNewSymbol()) {
        this.loadSearchedSymbol();
      }
    }
  }

  rowClass(item: TradingSymbol, flatIdx: number): string {
    const classes: string[] = [item.trend ?? 'neutral'];
    const auto = this.autonomousCards[item.symbol];
    if (auto) {
      classes.push(`action-${auto.action.toLowerCase()}`);
      if (auto.isRising) classes.push('regime-rising');
      if (auto.exhaustionProbability >= 55) classes.push('regime-exhaustion');
    }
    const priority = computeWatchlistPriority(item, this.marketTrend, flatIdx);
    classes.push(priority.cssClass);
    if (priority.pulse) classes.push('priority-pulse');
    if (item.symbol === this.selectedSymbol) classes.push('selected');
    if (item.highRvol) classes.push('high-rvol');
    if (flatIdx === this.highlightIndex) classes.push('kbd-highlight');
    if (item.symbol === this.flashSymbol) classes.push('flash-new');
    return classes.join(' ');
  }

  flatIndex(groupIdx: number, itemIdx: number): number {
    let idx = 0;
    for (let g = 0; g < groupIdx; g++) {
      if (!this.symbolGroups[g].collapsed) {
        idx += this.symbolGroups[g].items.length;
      }
    }
    return idx + itemIdx;
  }

  loadRowHighlighted(): boolean {
    return this.highlightIndex === this.flatVisibleSymbols.length - 1
      && this.flatVisibleSymbols[this.highlightIndex] === '__LOAD__';
  }

  flashAndScroll(symbol: string): void {
    this.flashSymbol = symbol.toUpperCase();
    setTimeout(() => {
      const el = document.getElementById(`watch-row-${symbol.toUpperCase()}`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 100);
    setTimeout(() => { this.flashSymbol = null; }, 2000);
  }

  signalRowClass(type: string, lifecycle?: string | null): string {
    const classes: string[] = [];
    if (type === 'EXIT') classes.push('row-exit');
    if (lifecycle === 'NEW') classes.push('life-new');
    if (lifecycle === 'WEAKENING') classes.push('life-weakening');
    if (lifecycle === 'INVALIDATED') classes.push('life-invalid');
    if (lifecycle === 'EXITED') classes.push('life-exited');
    return classes.join(' ');
  }

  trendClass(trend: string): string {
    return trend;
  }

  sparklineTrend(item: TradingSymbol): 'bullish' | 'bearish' | 'neutral' {
    const t = item.trend;
    if (t === 'bullish' || t === 'bearish' || t === 'neutral') return t;
    return 'neutral';
  }

  autonomousActionLabel(symbol: string): string {
    const auto = this.autonomousCards[symbol];
    return auto ? actionChipLabel(auto.action) : '';
  }

  mtfCompact(item: TradingSymbol): string {
    const summary = item.mtfSummary;
    if (summary) {
      return this.rowOverflow.resolveMtfSummary(summary, 200).plain;
    }
    const t5 = this.trendShort(item.trend5m);
    const t15 = this.trendShort(item.trend15m);
    const t1h = this.trendShort(item.trend1h);
    if (!t5 && !t15 && !t1h) return '';
    return `${t5 || '·'}/${t15 || '·'}/${t1h || '·'}`;
  }

  resolveMarketRow(row: MarketModeRow): SidebarRowResolved {
    return this.rowOverflow.resolveMarketModeRow(row);
  }

  resolveWatchMtf(item: TradingSymbol) {
    if (!item.mtfSummary) return null;
    return this.rowOverflow.resolveMtfSummary(item.mtfSummary, 180);
  }

  trendShort(trend?: string | null): string {
    if (!trend) return '';
    if (trend === 'bullish') return 'B';
    if (trend === 'bearish') return 'R';
    return 'N';
  }

  freshnessClass(freshness?: string | null): string {
    if (!freshness) return '';
    return `fresh-${freshness.toLowerCase()}`;
  }

  regimeClass(): string {
    const r = this.marketTrend?.regime?.toLowerCase() ?? '';
    if (r.includes('bull') || r === 'risk_on') return 'regime-bull';
    if (r.includes('bear') || r === 'risk_off') return 'regime-bear';
    if (r === 'choppy') return 'regime-chop';
    return 'regime-neutral';
  }

  togglePanel(key: string, current: boolean): boolean {
    const next = !current;
    this.workflowState.savePanelState(key, next);
    return next;
  }

  attentionScore(sig: ActiveSignal): number {
    return computeAttentionScore(sig);
  }

  signalHealth(sig: ActiveSignal) {
    return computeSignalHealth(sig);
  }

  watchHealth(item: TradingSymbol) {
    return healthFromSymbol(item);
  }

  watchPriority(item: TradingSymbol, flatIdx = 99) {
    return computeWatchlistPriority(item, this.marketTrend, flatIdx);
  }

  get watchCandidates(): WatchCandidate[] {
    return buildWatchCandidates(this.emergingSetups, this.symbols, this.bestSetup);
  }

  get marketModeActive(): boolean {
    return this.activeSignals.length === 0;
  }

  get marketModeRows(): MarketModeRow[] {
    const top = this.scannerSnapshot?.topOpportunities ?? [];
    return buildMarketModeRows(this.symbols, [], this.emergingSetups, top);
  }

  hasOptionsRisk(sig: ActiveSignal): boolean {
    return !!(sig.extended || (sig.optionsWarnings?.length ?? 0) > 0);
  }

  trackSignal(_: number, sig: ActiveSignal): string {
    return sig.timestamp + sig.symbol + sig.signalType;
  }

  get visibleOpportunities(): ActiveSignal[] {
    const ranked = this.dominantSnapshot?.topRanked ?? [];
    const order = new Map(ranked.map((r, i) => [r.card.symbol, i]));
    const base = this.activeSignals.slice(0, 12);
    return base.sort((a, b) => {
      const pa = order.get(a.symbol) ?? 99;
      const pb = order.get(b.symbol) ?? 99;
      if (pa !== pb) return pa - pb;
      const ca = this.autonomousCards[a.symbol]?.convictionScore ?? a.rankScore ?? 0;
      const cb = this.autonomousCards[b.symbol]?.convictionScore ?? b.rankScore ?? 0;
      if (cb !== ca) return cb - ca;
      const ea = this.autonomousCards[a.symbol]?.expansionProbability ?? 0;
      const eb = this.autonomousCards[b.symbol]?.expansionProbability ?? 0;
      if (eb !== ea) return eb - ea;
      const ta = this.autonomousCards[a.symbol]?.triggerIntegrity ?? 0;
      const tb = this.autonomousCards[b.symbol]?.triggerIntegrity ?? 0;
      return tb - ta;
    }).slice(0, 5);
  }

  autonomousCard(symbol: string): ScannerOpportunityCard | null {
    return this.autonomousCards[symbol] ?? null;
  }

  liveStateLabel(symbol: string): string | null {
    const card = this.autonomousCards[symbol];
    if (!card) return null;
    return resolveScannerLiveState(card).replace(/_/g, ' ');
  }

  opportunityVerb(symbol: string): string | null {
    const auto = this.autonomousCards[symbol];
    if (auto) return auto.badge.replace(/^[^\s]+\s/, '');
    const e = this.emergingSetups.find(x => x.symbol === symbol);
    if (e?.state === 'NEAR_TRIGGER') return `COMPRESSION IN ${this.triggerDistance(symbol)?.toFixed(1) ?? '0.4'}%`;
    const sig = this.activeSignals.find(s => s.symbol === symbol);
    if (sig?.signalType === 'WATCH') return 'WAIT';
    return null;
  }

  triggerDistance(symbol: string): number | null {
    const e = this.emergingSetups.find(x => x.symbol === symbol);
    if (e?.state !== 'NEAR_TRIGGER') return null;
    return 0.4;
  }

  radarEmphasis(symbol: string): boolean {
    const auto = this.autonomousCards[symbol];
    if (auto?.action === 'ENTER' || auto?.action === 'ADD') return true;
    if (auto?.action === 'AVOID' || auto?.action === 'EXIT') return true;
    const verb = this.opportunityVerb(symbol)?.toUpperCase() ?? '';
    if (verb.includes('EXHAUSTION') || verb.includes('EXIT')) return true;
    return this.emergingSetups.some(e => e.symbol === symbol && e.state === 'NEAR_TRIGGER');
  }

  rowDecay(symbol: string, rankIndex: number): number {
    const auto = this.autonomousCards[symbol];
    const sig = this.activeSignals.find(s => s.symbol === symbol);
    const stale = sig?.freshness === 'STALE' || sig?.freshness === 'AGING';
    const exhausted = auto?.action === 'AVOID' || (auto?.exhaustionProbability ?? 0) >= 60;
    const actionable = this.radarEmphasis(symbol) || rankIndex === 0 || symbol === this.selectedSymbol;
    let o = rowDecayOpacity(rankIndex, !!stale);
    const suppress = this.dominantEngine.suppressWeightForSymbol(symbol);
    o *= 1 - suppress * 0.35;
    o *= 0.55 + this.temporalForget * 0.45;
    if (exhausted) o *= 0.72;
    if (this.silenceActive && !actionable) o *= 0.88;
    if (actionable) o = Math.max(rankIndex === 0 || symbol === this.selectedSymbol ? 1 : 0.72, o);
    else if (rankIndex === 1) o = Math.max(0.68, Math.min(0.78, o));
    else o = Math.max(0.42, Math.min(0.52, o));
    if (this.sidebarLift > 0.18 && actionable) o = Math.min(1, o + 0.15);

    const dissolved = this.peripheralDissolve.resolve({
      chopMode: this.intensityMode === 'CHOP',
      actionable,
      hoveredOrFocused: false,
      rankIndex,
      baseOpacity: o
    });
    if (this.intensityMode === 'CHOP') {
      return dissolved.opacity;
    }
    return o;
  }

  toggleScan(): void {
    this.scanControl.toggleScan();
    this.refreshScanUi();
  }

  private refreshScanUi(): void {
    const { text, tone } = this.scanControl.statusLabel();
    this.scanLabel = text;
    this.scanTone = tone;
    this.cdr.markForCheck();
  }

  private refreshDominance(): void {
    const cards = this.collectDominanceCards();
    if (!cards.length) {
      this.dominantSnapshot = null;
      this.cdr.markForCheck();
      return;
    }
    this.dominantSnapshot = this.dominantEngine.recompute({
      cards,
      nanoBoosts: this.nanoPulse.snapshot(),
      marketTrend: this.marketTrend,
      watchlistSymbols: this._symbols.map(s => s.symbol)
    });
    this.cdr.markForCheck();
  }

  private collectDominanceCards(): ScannerOpportunityCard[] {
    const fromMap = Object.values(this.autonomousCards);
    if (fromMap.length) return fromMap;
    const snap = this.scannerSnapshot;
    if (!snap) return [];
    return [
      ...snap.topOpportunities,
      ...snap.highContinuation,
      ...snap.earlyExpansion,
      ...snap.institutionalPersistence,
      ...snap.healthyPullback,
      ...snap.compressionBreakout
    ].filter(c => c.action !== 'AVOID');
  }
}
