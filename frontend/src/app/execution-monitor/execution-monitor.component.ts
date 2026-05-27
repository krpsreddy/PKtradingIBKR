import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { interval, startWith, Subject, switchMap, takeUntil } from 'rxjs';
import { AutoExecutionSwitchComponent } from '../components/auto-execution-switch/auto-execution-switch.component';
import { ExecutionActiveCardComponent } from '../components/execution-active-card/execution-active-card.component';
import { PaperExecutionApiService } from '../services/paper-execution-api.service';
import { AssistedExitService } from '../services/assisted-exit-intelligence/assisted-exit.service';
import { AssistedExitSnapshot, AssistedPositionView } from '../services/assisted-exit-intelligence/assisted-exit.models';
import {
  ExecutionAnalytics,
  ExecutionMonitorSnapshot,
  PaperExecutionRecord
} from '../models/paper-execution.model';

@Component({
  selector: 'app-execution-monitor',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    NgClass,
    DecimalPipe,
    DatePipe,
    AutoExecutionSwitchComponent,
    ExecutionActiveCardComponent
  ],
  templateUrl: './execution-monitor.component.html',
  styleUrl: './execution-monitor.component.scss'
})
export class ExecutionMonitorComponent implements OnInit, OnDestroy {
  snapshot: ExecutionMonitorSnapshot | null = null;
  assisted: AssistedExitSnapshot | null = null;
  loading = true;
  error: string | null = null;
  closeExitPrice: Record<number, string> = {};

  private readonly destroy$ = new Subject<void>();

  constructor(
    private api: PaperExecutionApiService,
    private assistedExit: AssistedExitService
  ) {}

  ngOnInit(): void {
    interval(5_000)
      .pipe(
        startWith(0),
        switchMap(() => this.api.monitor()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: snap => {
          this.snapshot = snap;
          this.assisted = this.assistedExit.refresh(snap);
          this.loading = false;
          this.error = null;
        },
        error: err => {
          this.loading = false;
          this.error = err?.message ?? 'Failed to load execution monitor';
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  positionView(record: PaperExecutionRecord): AssistedPositionView | undefined {
    return this.assisted?.positions.find(p => p.record.id === record.id);
  }

  manualClose(record: PaperExecutionRecord): void {
    const raw = this.closeExitPrice[record.id];
    const exit = raw ? Number(raw) : record.fillPrice;
    this.api.manualClose(record.id, exit ?? undefined).subscribe({
      next: () => this.refreshOnce()
    });
  }

  analytics(): ExecutionAnalytics | null {
    return this.snapshot?.analytics ?? null;
  }

  regimeRows(): { regime: string; stats: ExecutionAnalytics['byRegime'][string] }[] {
    const by = this.analytics()?.byRegime ?? {};
    return Object.entries(by).map(([regime, stats]) => ({ regime, stats }));
  }

  pnlClass(v: number | undefined | null): string {
    if (v == null) return 'muted';
    if (v > 0) return 'pos';
    if (v < 0) return 'neg';
    return 'muted';
  }

  statusBadge(status: string): string {
    if (status === 'OPEN' || status === 'FILLED') return 'ok';
    if (status === 'BLOCKED' || status === 'REJECTED') return 'bad';
    if (status === 'SUBMITTED') return 'warn';
    return 'muted';
  }

  healthClass(tone: string): string {
    return tone.toLowerCase();
  }

  private refreshOnce(): void {
    this.api.monitor().subscribe(snap => {
      this.snapshot = snap;
      this.assisted = this.assistedExit.refresh(snap);
    });
  }
}
