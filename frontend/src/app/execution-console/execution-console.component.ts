import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, KeyValuePipe, NgClass, PercentPipe } from '@angular/common';
import { interval, startWith, Subject, switchMap, takeUntil } from 'rxjs';
import { AutoExecutionSwitchComponent } from '../components/auto-execution-switch/auto-execution-switch.component';
import { ExecutionActiveCardComponent } from '../components/execution-active-card/execution-active-card.component';
import { PaperExecutionApiService } from '../services/paper-execution-api.service';
import { AssistedExitService } from '../services/assisted-exit-intelligence/assisted-exit.service';
import { AssistedExitSnapshot, AssistedPositionView } from '../services/assisted-exit-intelligence/assisted-exit.models';
import { ExitResearchAnalyticsService } from '../services/autonomous-exit-research/exit-research-analytics.service';
import { ExitResearchSnapshot } from '../services/autonomous-exit-research/shadow-exit.models';
import { RealTimeExecutionService } from '../services/real-time-execution/real-time-execution.service';
import { ExecutionFeedItem } from '../services/real-time-execution/real-time-execution.models';
import { ExecutionMonitorSnapshot } from '../models/paper-execution.model';

@Component({
  selector: 'app-execution-console',
  standalone: true,
  imports: [
    RouterLink,
    NgClass,
    DecimalPipe,
    DatePipe,
    KeyValuePipe,
    PercentPipe,
    AutoExecutionSwitchComponent,
    ExecutionActiveCardComponent
  ],
  templateUrl: './execution-console.component.html',
  styleUrl: './execution-console.component.scss'
})
export class ExecutionConsoleComponent implements OnInit, OnDestroy {
  monitor: ExecutionMonitorSnapshot | null = null;
  assisted: AssistedExitSnapshot | null = null;
  exitResearch: ExitResearchSnapshot | null = null;
  dominantFeed: ExecutionFeedItem[] = [];
  closePrices: Record<number, string> = {};
  loading = true;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private api: PaperExecutionApiService,
    private assistedExit: AssistedExitService,
    private exitResearchSvc: ExitResearchAnalyticsService,
    private rtExecution: RealTimeExecutionService
  ) {}

  ngOnInit(): void {
    interval(5_000)
      .pipe(
        startWith(0),
        switchMap(() => this.api.monitor()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: m => {
          this.monitor = m;
          this.assisted = this.assistedExit.refresh(m);
          this.exitResearch = this.exitResearchSvc.refresh(m);
          this.dominantFeed = this.rtExecution.topFeed(8);
          this.loading = false;
        },
        error: () => (this.loading = false)
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  activeViews(): AssistedPositionView[] {
    return this.assisted?.positions ?? [];
  }

  advisories(): AssistedPositionView[] {
    return [...this.activeViews()].sort(
      (a, b) => b.metrics.exitPressure - a.metrics.exitPressure
    );
  }

  paperPnl(): { open: number; closed: number } {
    const h = this.monitor?.history ?? [];
    const closed = h.filter(x => x.status === 'CLOSED');
    const open = this.monitor?.activePositions ?? [];
    return {
      open: open.reduce((s, r) => s + (r.mfeR ?? 0), 0),
      closed: closed.reduce((s, r) => s + (r.realizedR ?? 0), 0)
    };
  }

  manualClose(view: AssistedPositionView): void {
    const raw = this.closePrices[view.record.id];
    const exit = raw ? Number(raw) : view.record.fillPrice;
    this.api.manualClose(view.record.id, exit ?? undefined).subscribe(() => this.refresh());
  }

  private refresh(): void {
    this.api.monitor().subscribe(m => {
      this.monitor = m;
      this.assisted = this.assistedExit.refresh(m);
      this.exitResearch = this.exitResearchSvc.refresh(m);
    });
  }
}
