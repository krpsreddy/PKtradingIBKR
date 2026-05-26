import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AnalyticsDistributionEngine } from '../../services/analytics-query/analytics-distribution.engine';
import { AnalyticsQuerySynthesisService } from '../../services/analytics-query/analytics-query-synthesis.service';
import { AnalyticsWorkbench, GroupStat } from '../../services/analytics-query/analytics-query.models';
import { formatReviewLabel } from '../../utils/autonomous-terminology.util';

@Component({
  selector: 'app-analytics-query-workbench',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics-query-workbench.component.html',
  styleUrl: './analytics-query-workbench.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnalyticsQueryWorkbenchComponent implements OnInit, OnChanges, OnDestroy {
  @Input() symbol = '';

  loading = false;
  error: string | null = null;
  workbench: AnalyticsWorkbench | null = null;
  dbSnapshotCount = 0;
  filterDecision = 'ALL';
  filterConviction = 'ALL';

  private sub?: Subscription;

  constructor(
    private synthesis: AnalyticsQuerySynthesisService,
    public dist: AnalyticsDistributionEngine,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.synthesis.state$.subscribe(s => {
      this.loading = s.loading;
      this.error = s.error;
      this.workbench = s.workbench;
      this.dbSnapshotCount = s.dbSnapshotCount;
      this.cdr.markForCheck();
    });
    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['symbol'] && this.symbol) {
      this.synthesis.setSymbol(this.symbol);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  refresh(): void {
    void this.synthesis.load({
      symbol: this.symbol || undefined,
      decision: this.filterDecision !== 'ALL' ? this.filterDecision : undefined,
      convictionBand: this.filterConviction !== 'ALL' ? this.filterConviction : undefined
    });
  }

  onFilterChange(): void {
    this.refresh();
  }

  bandRows() {
    return this.dist.bandRows(this.workbench?.convictionDistribution ?? null);
  }

  maxStatCount(stats: GroupStat[]): number {
    return this.dist.maxCount(stats);
  }

  barWidth(count: number, max: number): number {
    return this.dist.barWidth(count, max);
  }

  topNarratives(): GroupStat[] {
    return (this.workbench?.narrativeStats ?? []).slice(0, 8);
  }

  matrixCells() {
    return (this.workbench?.crossMatrix.cells ?? []).slice(0, 24);
  }

  formatGroup(value: string): string {
    return formatReviewLabel(value);
  }
}
