import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  HistoricalBulkDiscoveryApi,
  HistoricalBulkDiscoveryReport,
  HistoricalDiscoveryDirection,
  HistoricalLookbackDays
} from '../services/discovery/historical-bulk-discovery.api';

/** Phase 204/206 — directional historical discovery (bullish or bearish). */
@Component({
  selector: 'app-historical-bulk-discovery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historical-bulk-discovery.component.html',
  styleUrl: './historical-bulk-discovery.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoricalBulkDiscoveryComponent implements OnInit, OnChanges {
  @Input() direction: HistoricalDiscoveryDirection = 'bullish';

  report: HistoricalBulkDiscoveryReport | null = null;
  loading = false;
  error: string | null = null;
  lookbackDays: HistoricalLookbackDays = 60;
  readonly lookbackOptions: HistoricalLookbackDays[] = [7, 30, 60, 90];

  get isBearish(): boolean {
    return this.direction === 'bearish';
  }

  get panelTitle(): string {
    return this.isBearish ? 'Bearish breakdown intelligence' : 'Bullish continuation intelligence';
  }

  constructor(
    private api: HistoricalBulkDiscoveryApi,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    void this.load(false);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['direction'] && !changes['direction'].firstChange) {
      void this.load(false);
    }
  }

  setLookback(d: HistoricalLookbackDays): void {
    this.lookbackDays = d;
    void this.load(false);
  }

  refresh(): void {
    void this.load(true);
  }

  private async load(refresh: boolean): Promise<void> {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    try {
      this.report = await this.api.load(this.lookbackDays, refresh, this.direction);
      if (this.report.meta.sampleCount < 10) {
        this.error = 'Low sample count — hydrate 60D history in Global Edge Lab, sync analytics, then refresh.';
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to load historical discovery';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  formatPct(v: number): string {
    return `${Math.round(v)}%`;
  }

  formatR(v: number): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
  }

  confidenceClass(score: number): string {
    if (score >= 75) return 'high';
    if (score >= 55) return 'med';
    return 'low';
  }

  verdictClass(v: string): string {
    return v.toLowerCase().replace(/_/g, '-');
  }
}
