import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe, NgClass, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { ExecutionReviewApiService } from '../services/execution-review/execution-review-api.service';
import {
  ContinuationCapture,
  DailySummary,
  QueueAnalysis,
  RegimePerformance,
  ReviewFilters,
  SessionAnalysis,
  TradeReview
} from '../services/execution-review/execution-review.models';
import { ReplayLaunchIntentService } from '../services/signal-centric-replay/replay-launch-intent.service';
import { SignalReplayLaunchPlan } from '../services/signal-explorer/signal-explorer.models';

@Component({
  selector: 'app-execution-review',
  standalone: true,
  imports: [RouterLink, DecimalPipe, NgClass, UpperCasePipe, FormsModule],
  templateUrl: './execution-review.component.html',
  styleUrl: './execution-review.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExecutionReviewComponent implements OnInit, OnDestroy {
  loading = true;
  error: string | null = null;

  summary: DailySummary | null = null;
  trades: TradeReview[] = [];
  regimes: RegimePerformance[] = [];
  continuation: ContinuationCapture[] = [];
  queue: QueueAnalysis | null = null;
  sessions: SessionAnalysis[] = [];
  selected: TradeReview | null = null;

  filters: ReviewFilters = {
    date: '',
    regime: '',
    lifecycle: '',
    outcome: '',
    symbol: '',
    sessionPeriod: '',
    entryQuality: '',
    exitQuality: ''
  };

  private readonly destroy$ = new Subject<void>();

  constructor(
    private api: ExecutionReviewApiService,
    private replayIntent: ReplayLaunchIntentService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refresh(): void {
    this.loading = true;
    this.error = null;
    const f = this.filters;
    const date = f.date || undefined;

    forkJoin({
      summary: this.api.dailySummary(date),
      trades: this.api.trades(f),
      regimes: this.api.regimePerformance(date),
      continuation: this.api.continuationCapture(date),
      queue: this.api.queueAnalysis(date),
      sessions: this.api.sessionAnalysis(date)
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: r => {
          this.summary = r.summary;
          this.trades = r.trades.trades;
          this.regimes = r.regimes;
          this.continuation = r.continuation;
          this.queue = r.queue;
          this.sessions = r.sessions;
          if (!this.selected && this.trades.length) {
            this.selected = this.trades[0];
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: e => {
          this.error = e?.message ?? 'Failed to load execution review';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  selectTrade(t: TradeReview): void {
    this.selected = t;
    this.cdr.markForCheck();
  }

  openReplay(t: TradeReview): void {
    const r = t.replay;
    const plan: SignalReplayLaunchPlan = {
      signalId: r.signalId,
      symbol: r.symbol.toUpperCase(),
      sessionDate: r.sessionDate,
      replayIndex: r.replayIndex,
      timestampMs: r.timestampMs,
      openReviewMode: true,
      centerViewport: true,
      pauseReplay: true,
      replayMode: 'REVIEW_SIGNAL',
      journeySteps: t.timeline.map(e => e.phase)
    };
    this.replayIntent.setPending(plan);
    void this.router.navigate(['/replay-lab'], { state: { replayPlan: plan } });
  }

  formatR(v: number | null | undefined): string {
    if (v == null) return '—';
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
  }

  formatLabel(v: string | null | undefined): string {
    if (!v) return '—';
    return v.replace(/_/g, ' ');
  }

  formatTime(ms: number): string {
    if (!ms) return '—';
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  outcomeClass(o: string): string {
    return (o ?? '').toLowerCase();
  }

  qualityClass(q: string): string {
    return (q ?? '').toLowerCase();
  }
}
