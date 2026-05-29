import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LookbackDays,
  RegimeIntelligenceDiscoveryApi,
  RegimeIntelligenceReport
} from '../services/discovery/regime-intelligence-discovery.api';

/** Phase 203 — 60-day empirical regime intelligence (execution telemetry). */
@Component({
  selector: 'app-regime-intelligence-60d',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './regime-intelligence-60d.component.html',
  styleUrl: './regime-intelligence-60d.component.scss'
})
export class RegimeIntelligence60dComponent implements OnInit {
  report: RegimeIntelligenceReport | null = null;
  loading = false;
  error: string | null = null;
  lookbackDays: LookbackDays = 60;
  readonly lookbackOptions: LookbackDays[] = [7, 30, 60, 90];

  constructor(
    private api: RegimeIntelligenceDiscoveryApi,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    void this.reload();
  }

  setLookback(days: LookbackDays): void {
    this.lookbackDays = days;
    void this.reload();
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.api.loadReport(this.lookbackDays)
      .then(r => {
        this.report = r;
        if (r.meta.closedTrades < 3) {
          this.error = 'Fewer than 3 closed paper trades in window — run evolution paper execution to build evidence.';
        }
      })
      .catch(err => {
        this.error = err instanceof Error ? err.message : 'Failed to load regime intelligence';
      })
      .finally(() => {
        this.loading = false;
        this.cdr.markForCheck();
      });
  }

  formatR(v: number | null | undefined): string {
    if (v == null || Number.isNaN(v)) return '—';
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
  }
}
