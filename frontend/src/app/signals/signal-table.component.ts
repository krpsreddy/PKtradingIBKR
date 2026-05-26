import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { TradingSignal } from '../models/signal.model';
import { MarketTrend } from '../models/workspace.model';
import { computeSignalHealth } from '../utils/signal-health.util';
import { ConfidenceBarComponent } from '../components/confidence-bar/confidence-bar.component';
import { ConfidenceBadgeComponent } from '../components/confidence-badge/confidence-badge.component';
import { computeAttentionPriority, priorityClass } from '../utils/attention-priority.util';
import { computeEntryQuality } from '../utils/execution-guidance.util';
import { detectSetupDeterioration } from '../utils/setup-deterioration.util';
import { SetupCandidate } from '../models/execution.model';
import { formatAutonomousRegime, resolveAutonomousRegime } from '../utils/autonomous-terminology.util';

@Component({
  selector: 'app-signal-table',
  standalone: true,
  imports: [MatTableModule, DatePipe, NgClass, ConfidenceBarComponent, ConfidenceBadgeComponent],
  templateUrl: './signal-table.component.html',
  styleUrl: './signal-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignalTableComponent {
  @Input() signals: TradingSignal[] = [];
  @Input() marketTrend: MarketTrend | null = null;
  @Input() regimeWinRates: Record<string, number> = {};
  @Input() collapsed = false;
  @Input() emptyTitle = '';
  @Input() emptyDetail = '';
  @Output() toggleCollapse = new EventEmitter<void>();
  @Output() rowSelected = new EventEmitter<TradingSignal>();

  displayLimit = 100;
  expandedRow: string | null = null;

  displayedColumns = ['timestamp', 'symbol', 'signalType', 'entry', 'prob', 'attention', 'health', 'confidence', 'freshness'];

  get visibleSignals(): TradingSignal[] {
    return this.signals.slice(0, this.displayLimit);
  }

  get hasMore(): boolean {
    return this.signals.length > this.displayLimit;
  }

  loadMore(): void {
    this.displayLimit += 100;
  }

  badgeClass(type: string): string {
    switch (resolveAutonomousRegime(type)) {
      case 'EARLY_EXPANSION': return 'badge-open';
      case 'SHALLOW_PULLBACK_CONTINUATION': return 'badge-pull';
      case 'VWAP_ACCEPTANCE': return 'badge-cont';
      case 'FAILED_EXPANSION': return 'badge-fail';
      case 'EXHAUSTION_DRIFT': return 'badge-exit';
      case 'COMPRESSION_BREAKOUT': return 'badge-scout';
      case 'PERSISTENT_CONTINUATION': return 'badge-mom';
      default: return 'badge-mom';
    }
  }

  displayType(type: string): string {
    return formatAutonomousRegime(type);
  }

  freshnessClass(freshness?: string | null): string {
    if (!freshness) return '';
    return `fresh-${freshness.toLowerCase()}`;
  }

  health(row: TradingSignal) {
    return computeSignalHealth(row);
  }

  signalIcon(type: string): string {
    const regime = type.toUpperCase();
    if (regime.includes('EXHAUST') || regime.includes('FAIL')) return '🔴';
    if (regime.includes('EARLY') || regime.includes('OPEN')) return '🟢';
    if (regime.includes('VWAP')) return '🟢';
    if (regime.includes('COMPRESSION')) return '🟡';
    if (regime.includes('CONT') || regime.includes('PERSIST')) return '🟢';
    if (type === 'EXIT') return '✕';
    return '•';
  }

  asCandidate(row: TradingSignal): SetupCandidate {
    return {
      symbol: row.symbol ?? '',
      signalType: row.signalType,
      rankScore: row.rankScore,
      relativeVolume: row.relativeVolume,
      extended: row.extended,
      mtfSummary: row.mtfSummary,
      freshness: row.freshness,
      freshnessLabel: row.freshnessLabel,
      lifecycleState: row.lifecycleState,
      optionsWarnings: row.optionsWarnings
    };
  }

  attention(row: TradingSignal) {
    return computeAttentionPriority(this.asCandidate(row), this.marketTrend, 0);
  }

  priorityCls(row: TradingSignal): string {
    return priorityClass(this.attention(row).priority);
  }

  entryQuality(row: TradingSignal): string {
    if (!row.price) return '—';
    const vwap = row.vwap ?? row.price;
    return computeEntryQuality(this.asCandidate(row), row.price, {
      ema9: vwap,
      ema20: vwap,
      ema50: vwap,
      rsi: row.rsi ?? 50,
      macd: row.macd ?? 0,
      signalLine: row.macd ?? 0,
      vwap,
      avgVolume: 0,
      relativeVolume: row.relativeVolume ?? 0
    });
  }

  entryClass(row: TradingSignal): string {
    const q = this.entryQuality(row);
    return q === '—' ? '' : `entry-${q.toLowerCase()}`;
  }

  deterioration(row: TradingSignal) {
    return detectSetupDeterioration(this.asCandidate(row), null, null, row.price ?? null);
  }

  confidenceValue(row: TradingSignal): number {
    return row.rankScore ?? row.confidenceScore ?? this.attention(row).score;
  }

  winRate(row: TradingSignal): number | null {
    return this.regimeWinRates[row.signalType] ?? null;
  }

  rowKey(row: TradingSignal): string {
    return row.timestamp + (row.symbol ?? '') + row.signalType;
  }

  onRowClick(row: TradingSignal): void {
    this.rowSelected.emit(row);
  }

  toggleExpand(row: TradingSignal, event: MouseEvent): void {
    event.stopPropagation();
    const k = this.rowKey(row);
    this.expandedRow = this.expandedRow === k ? null : k;
  }

  isExpanded(row: TradingSignal): boolean {
    return this.expandedRow === this.rowKey(row);
  }
}
