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
import { FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import {
  DEFAULT_SIGNAL_EXPLORER_FILTERS,
  SignalDecisionFilter,
  SignalExplorerFilters,
  SignalExplorerRow,
  SignalNarrativeFilter,
  SignalQualityFilter,
  SignalResultFilter,
  SignalSideFilter,
  SignalSortMode,
  SignalTimeWindow
} from '../../services/signal-explorer/signal-explorer.models';
import { DaySignalHeat } from '../../services/signal-explorer/historical-signal-index.engine';
import { SignalExplorerSynthesisService } from '../../services/signal-explorer/signal-explorer-synthesis.service';
import { SignalSmartShortcut } from '../../services/signal-centric-replay/signal-centric-replay.models';
import { formatReviewLabel } from '../../utils/autonomous-terminology.util';

@Component({
  selector: 'app-signal-explorer-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, ScrollingModule],
  templateUrl: './signal-explorer-panel.component.html',
  styleUrl: './signal-explorer-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignalExplorerPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input() symbol = 'NVDA';
  @Input() compact = false;
  @Input() docked = false;
  @Input() fullHeight = false;

  @Output() openReplay = new EventEmitter<string>();

  loading = false;
  error: string | null = null;
  errorKind: 'network' | 'empty' | 'filters' | null = null;
  rows: SignalExplorerRow[] = [];
  discovery = null as import('../../services/signal-explorer/signal-explorer.models').SignalExplorerDiscovery | null;
  filters: SignalExplorerFilters = { ...DEFAULT_SIGNAL_EXPLORER_FILTERS };
  selectedSignalId: string | null = null;
  heatmap: DaySignalHeat[] = [];
  bulkReviewActive = false;
  totalSignals = 0;
  journeySteps: string[] = [];

  readonly sideOptions: SignalSideFilter[] = ['ALL', 'BUY', 'SELL'];
  readonly decisionOptions: SignalDecisionFilter[] = [
    'ALL', 'FULL_EXECUTION', 'PROBING_EXECUTION', 'RECLAIM_ENTRY', 'SECOND_LEG',
    'BREAKOUT', 'VWAP_RECLAIM', 'TREND_CONTINUATION', 'TRAP_RISK', 'EXIT_NOW', 'STOP_HIT'
  ];
  readonly narrativeOptions: SignalNarrativeFilter[] = [
    'ALL', 'VWAP_RECLAIM', 'FAILED_BREAKOUT', 'SECOND_LEG', 'ACCEPTANCE', 'TREND_CONTINUATION', 'EXHAUSTION'
  ];
  readonly timeOptions: SignalTimeWindow[] = ['TODAY', '5D', '20D', '60D'];
  readonly qualityOptions: SignalQualityFilter[] = ['ALL', 'ELITE', 'HIGH', 'INSTITUTIONAL', 'LOW_FAKEOUT', 'HIGH_EXPECTANCY'];
  readonly resultOptions: SignalResultFilter[] = ['ALL', 'WINNERS', 'LOSERS', 'GT_2R', 'TRAP_AVOIDED', 'FAKEOUTS'];
  readonly convictionOptions = ['ALL', 'ELITE', 'HIGH', 'MEDIUM', 'LOW'] as const;
  readonly sortOptions: { id: SignalSortMode; label: string }[] = [
    { id: 'TIME_DESC', label: 'Recent' },
    { id: 'CONVICTION', label: 'Conviction' },
    { id: 'EXPECTANCY', label: 'Expectancy' },
    { id: 'ACTUAL_R', label: 'Result R' }
  ];
  readonly shortcuts: { id: SignalSmartShortcut; label: string }[] = [
    { id: 'BEST_WINNERS', label: 'Best Winners' },
    { id: 'BIGGEST_FAILURES', label: 'Biggest Failures' },
    { id: 'ELITE_RECLAIMS', label: 'Elite Reclaims' },
    { id: 'TRAP_DAYS', label: 'Trap Days' },
    { id: 'HIGH_CONVICTION', label: 'High Conviction' },
    { id: 'FAILED_HIGH_CONVICTION', label: 'Failed High Conv' },
    { id: 'BEST_SECOND_LEGS', label: 'Best Second Legs' }
  ];

  private sub?: Subscription;
  private readonly destroy$ = new Subject<void>();
  private readonly searchDebounce$ = new Subject<void>();

  constructor(
    private explorer: SignalExplorerSynthesisService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.searchDebounce$.pipe(debounceTime(280), takeUntil(this.destroy$)).subscribe(() => {
      this.explorer.setFilters({ searchText: this.filters.searchText });
    });
    this.sub = this.explorer.state$.subscribe(state => {
      this.loading = state.loading;
      this.error = state.error;
      this.errorKind = state.error?.includes('unavailable') ? 'network'
        : state.error?.includes('filters') ? 'filters'
        : state.error ? 'empty' : null;
      this.rows = state.filteredRows;
      this.filters = { ...state.filters };
      this.selectedSignalId = state.selectedSignalId;
      this.discovery = state.discovery;
      this.bulkReviewActive = state.bulkReviewActive;
      this.heatmap = this.explorer.heatmap();
      this.totalSignals = this.explorer.totalSignals;
      this.journeySteps = this.explorer.journeySteps;
      this.cdr.markForCheck();
    });
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['symbol'] && !changes['symbol'].firstChange) {
      this.refresh();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.sub?.unsubscribe();
  }

  refresh(): void {
    if (this.symbol) this.explorer.loadSymbol(this.symbol);
  }

  onFilterChange(): void {
    this.explorer.setFilters({ ...this.filters });
  }

  onConvictionChange(band: string): void {
    this.filters.highConvictionOnly = band === 'HIGH' || band === 'ELITE';
    this.explorer.setFilters({ ...this.filters, highConvictionOnly: this.filters.highConvictionOnly });
  }

  onSearchInput(): void {
    this.searchDebounce$.next();
  }

  onShortcut(shortcut: SignalSmartShortcut): void {
    this.explorer.applyShortcut(shortcut);
  }

  onRowClick(row: SignalExplorerRow): void {
    this.explorer.selectSignal(row.signalId);
    this.explorer.openSignal(row.signalId);
  }

  onTrainClick(row: SignalExplorerRow, event: Event): void {
    event.stopPropagation();
    this.explorer.trainFromSignal(row.signalId);
  }

  onOpenReplay(row: SignalExplorerRow, event: Event): void {
    event.stopPropagation();
    this.explorer.openSignal(row.signalId);
    this.openReplay.emit(row.symbol);
  }

  onBulkReviewNext(): void {
    this.explorer.bulkReviewNext();
  }

  toneClass(row: SignalExplorerRow): string {
    const r = row.actualR;
    if (row.entryQuality === 'TRAP' || row.decision?.includes('TRAP')) return 'tone-trap';
    if (r != null && r >= 2) return 'tone-elite';
    if (r != null && r >= 0.5) return 'tone-win';
    if (row.narrative?.includes('RECLAIM')) return 'tone-reclaim';
    if (r != null && r < -0.5) return 'tone-trap';
    return 'tone-neutral';
  }

  qualityLabel(row: SignalExplorerRow): string {
    return (row.entryQuality ?? '—').replace(/_/g, ' ');
  }

  formatFilterLabel(value: string): string {
    return formatReviewLabel(value);
  }

  heatToneClass(tone: string): string {
    return `heat-${tone}`;
  }

  trackRow(_: number, row: SignalExplorerRow): string {
    return row.signalId;
  }
}
