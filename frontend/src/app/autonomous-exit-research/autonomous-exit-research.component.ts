import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, KeyValuePipe, NgClass } from '@angular/common';
import { interval, startWith, Subject, switchMap, takeUntil } from 'rxjs';
import { PaperExecutionApiService } from '../services/paper-execution-api.service';
import { ExitResearchAnalyticsService } from '../services/autonomous-exit-research/exit-research-analytics.service';
import { ExitResearchSnapshot } from '../services/autonomous-exit-research/shadow-exit.models';

@Component({
  selector: 'app-autonomous-exit-research',
  standalone: true,
  imports: [RouterLink, DecimalPipe, NgClass, KeyValuePipe],
  templateUrl: './autonomous-exit-research.component.html',
  styleUrl: './autonomous-exit-research.component.scss'
})
export class AutonomousExitResearchComponent implements OnInit, OnDestroy {
  research: ExitResearchSnapshot | null = null;
  loading = true;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private api: PaperExecutionApiService,
    private exitResearch: ExitResearchAnalyticsService
  ) {}

  ngOnInit(): void {
    interval(8_000)
      .pipe(
        startWith(0),
        switchMap(() => this.api.monitor()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: m => {
          this.research = this.exitResearch.refresh(m);
          this.loading = false;
        },
        error: () => (this.loading = false)
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
