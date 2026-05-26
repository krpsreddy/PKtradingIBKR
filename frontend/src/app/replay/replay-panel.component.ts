import { Component, EventEmitter, Input, OnChanges, Output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, NgForOf } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ReplayHistory, ReplaySignalEvent, ReplaySpeed } from '../models/replay.model';
import { lastTradingDayIso } from '../utils/market-date.util';
import {
  ReplayDisplayMode,
  ReplaySessionCatalogEntry,
  ReplaySignalJumpKind,
  ReplayStartMode,
  ReplayWorkstationMode
} from '../services/replay-workstation/replay-workstation.models';
import {
  ReplayActionFeedback,
  ReplayBreadcrumb,
  ReplayDebugInfo,
  ReplayPanelTab,
  ReplayUxStatus
} from '../services/replay-workstation/replay-ux.models';

@Component({
  selector: 'app-replay-panel',
  standalone: true,
  imports: [FormsModule, DecimalPipe, ScrollingModule, NgForOf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './replay-panel.component.html',
  styleUrl: './replay-panel.component.scss'
})
export class ReplayPanelComponent implements OnChanges {
  @Input() symbol = 'NVDA';
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() history: ReplayHistory | null = null;
  @Input() currentIndex = -1;
  @Input() playing = false;
  @Input() speed: ReplaySpeed = 1;
  @Input() visibleTimeline: ReplaySignalEvent[] = [];
  @Input() visibleScores: { timestamp: string; engine: string; score: number; scoreLabel: string }[] = [];
  @Input() selectedEvent: ReplaySignalEvent | null = null;
  @Input() replayDateInput = lastTradingDayIso();
  @Input() sessions: ReplaySessionCatalogEntry[] = [];
  @Input() cacheHit = false;
  @Input() displayMode: ReplayDisplayMode = 'PLAYBACK';
  @Input() workstationMode: ReplayWorkstationMode = 'SINGLE_SESSION';
  @Input() startMode: ReplayStartMode = 'SMART';
  @Input() reviewMode = false;
  @Input() decisionRows: import('../services/replay-decision-visualization/replay-decision-visualization.models').ReplayDecisionTimelineRow[] = [];
  @Input() contextMode: import('../services/replay-decision-visualization/replay-decision-visualization.models').ReplayContextMode = 'PREVIOUS_DAY';
  @Input() uxStatus: ReplayUxStatus = 'READY';
  @Input() actionFeedback: ReplayActionFeedback | null = null;
  @Input() breadcrumb: ReplayBreadcrumb | null = null;
  @Input() debugInfo: ReplayDebugInfo | null = null;
  @Input() activeTab: ReplayPanelTab = 'timeline';
  @Input() bottomExpanded = true;
  @Input() pendingAction: string | null = null;

  @Output() dateChange = new EventEmitter<string>();
  @Output() loadReplay = new EventEmitter<void>();
  @Output() play = new EventEmitter<void>();
  @Output() pause = new EventEmitter<void>();
  @Output() stepForward = new EventEmitter<void>();
  @Output() speedChange = new EventEmitter<ReplaySpeed>();
  @Output() eventSelected = new EventEmitter<ReplaySignalEvent>();
  @Output() seekIndex = new EventEmitter<number>();
  @Output() jumpToHead = new EventEmitter<void>();
  @Output() sessionSelect = new EventEmitter<string>();
  @Output() sessionNav = new EventEmitter<'prev' | 'next' | 'best' | 'conviction'>();
  @Output() signalJump = new EventEmitter<ReplaySignalJumpKind>();
  @Output() displayModeChange = new EventEmitter<ReplayDisplayMode>();
  @Output() workstationModeChange = new EventEmitter<ReplayWorkstationMode>();
  @Output() startModeChange = new EventEmitter<ReplayStartMode>();
  @Output() contextModeChange = new EventEmitter<import('../services/replay-decision-visualization/replay-decision-visualization.models').ReplayContextMode>();
  @Output() seekToDecision = new EventEmitter<number>();
  @Output() tabChange = new EventEmitter<ReplayPanelTab>();
  @Output() toggleBottom = new EventEmitter<void>();
  @Output() workflowJump = new EventEmitter<ReplaySignalJumpKind>();

  replayDate = this.replayDateInput;
  scrubIndex = 0;

  readonly tabs: { id: ReplayPanelTab; label: string }[] = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'decisions', label: 'Decisions' },
    { id: 'lifecycle', label: 'Lifecycle' },
    { id: 'inspector', label: 'Inspector' },
    { id: 'scores', label: 'Scores' }
  ];

  readonly startModes: { id: ReplayStartMode; label: string }[] = [
    { id: 'SMART', label: 'Smart start' },
    { id: 'OPEN', label: 'Market open' },
    { id: 'FIRST_SIGNAL', label: 'First signal' },
    { id: 'FIRST_ENTRY', label: 'First entry' },
    { id: 'VWAP_RECLAIM', label: 'VWAP reclaim' },
    { id: 'SECOND_LEG', label: 'Second leg' }
  ];

  ngOnChanges(): void {
    this.replayDate = this.replayDateInput;
    if (this.currentIndex >= 0) this.scrubIndex = this.currentIndex;
  }

  speeds: ReplaySpeed[] = [1, 2, 5];

  statusLabel(): string {
    switch (this.uxStatus) {
      case 'LOADING_SESSION': return 'LOADING SESSION';
      case 'SNAPPING_TO_SIGNAL': return 'SNAPPING TO SIGNAL';
      case 'APPLYING_CONTEXT': return 'APPLYING CONTEXT';
      case 'PLAYING': return 'PLAYING';
      case 'PAUSED': return 'PAUSED';
      case 'REVIEW_MODE': return 'REVIEW MODE';
      default: return 'READY';
    }
  }

  statusClass(): string {
    return `status-${this.uxStatus.toLowerCase().replace(/_/g, '-')}`;
  }

  selectTab(tab: ReplayPanelTab): void {
    this.tabChange.emit(tab);
  }

  onDateInput(): void {
    this.dateChange.emit(this.replayDate);
  }

  onSessionPick(date: string): void {
    if (date) this.sessionSelect.emit(date);
  }

  onScrubInput(): void {
    this.seekIndex.emit(this.scrubIndex);
  }

  onWorkflow(kind: ReplaySignalJumpKind): void {
    this.workflowJump.emit(kind);
  }

  markerIcon(type: string): string {
    if (type === 'OPEN_SCOUT') return '⚡';
    if (type === 'OPEN_MOM_BUY') return '🚀';
    if (type === 'OPEN_FAIL') return '🔻';
    if (type === 'OPEN_FAIL_BREAK') return '⬇';
    if (type === 'OPEN_FAIL_READY') return '⚠';
    if (type === 'RECOVERY_FAIL') return '📉';
    if (type === 'RECOVERY_FAIL_READY') return '⚠';
    if (type === 'IMBALANCE_DOWN') return '⬇';
    if (type === 'IMBALANCE_UP') return '⬆';
    if (type === 'CONT_BUY') return '🔵';
    if (type === 'CONT_READY') return '◻';
    if (type === 'PULL_READY') return '🟢';
    if (type === 'PULL_BUY') return '🟢';
    if (type === 'MOM_READY') return '◉';
    if (type === 'MOM_BUY') return '🟢';
    if (type === 'OPEN_READY') return '◎';
    if (type === 'EXIT') return '⏹';
    if (type === 'EXTENDED') return '⚠';
    return '•';
  }

  formatTime(iso: string): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(iso));
  }

  selectEvent(ev: ReplaySignalEvent): void {
    this.eventSelected.emit(ev);
  }

  currentBarLabel(): string {
    if (!this.history || this.currentIndex < 0) return '—';
    const bar = this.history.sessionCandles[this.currentIndex];
    return bar ? this.formatTime(bar.time) : '—';
  }

  progressPercent(): number {
    if (!this.history?.totalBars) return 0;
    return Math.max(0, Math.min(100, ((this.currentIndex + 1) / this.history.totalBars) * 100));
  }

  toggleReviewMode(): void {
    this.displayModeChange.emit(this.reviewMode ? 'PLAYBACK' : 'REVIEW');
  }

  toggleTrainingMode(): void {
    this.displayModeChange.emit('TRAINING');
  }

  sessionLabel(entry: ReplaySessionCatalogEntry): string {
    const sig = entry.signalCount > 0 ? `${entry.signalCount} signals` : 'No signals';
    const status = entry.healthLabel ?? entry.status ?? (entry.replayReady ? 'READY' : 'Stale');
    const conv = entry.convictionAvg;
    const convPart = conv != null && conv > 0 ? ` · ${Math.round(conv)}% conv` : '';
    return `${entry.label} · ${sig} · ${status}${convPart}`;
  }

  onDecisionRowClick(row: import('../services/replay-decision-visualization/replay-decision-visualization.models').ReplayDecisionTimelineRow): void {
    this.seekToDecision.emit(row.barIndex);
  }

  trackEvent(_: number, ev: ReplaySignalEvent): string {
    return `${ev.timestamp}:${ev.signalType}`;
  }

  trackDecisionRow(_: number, row: import('../services/replay-decision-visualization/replay-decision-visualization.models').ReplayDecisionTimelineRow): string {
    return `${row.time}:${row.signalType}:${row.barIndex}`;
  }

  trackScore(_: number, pt: { timestamp: string; engine: string }): string {
    return `${pt.timestamp}:${pt.engine}`;
  }
}
