import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import { Subscription } from 'rxjs';
import { LiveExecutionFeedRowComponent } from './live-execution-feed-row.component';
import { RealTimeExecutionService } from '../../services/real-time-execution/real-time-execution.service';
import { ExecutionFrameworkMode167 } from '../../services/real-time-execution/real-time-execution.models';
import { EnrichedOpportunity } from '../../services/execution-intelligence/enriched-opportunity.model';

/** Phase 167/169 — live autonomous execution feed with calibrated ranking. */
@Component({
  selector: 'app-live-execution-feed',
  standalone: true,
  imports: [LiveExecutionFeedRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-execution-feed.component.html',
  styleUrl: './live-execution-feed.component.scss'
})
export class LiveExecutionFeedComponent implements OnInit, OnDestroy {
  @Input() selectedSymbol = 'NVDA';
  @Input() executionMode: ExecutionFrameworkMode167 = 'CONFIRMED';
  @Output() symbolSelect = new EventEmitter<string>();
  @Output() executionModeChange = new EventEmitter<ExecutionFrameworkMode167>();

  feed: EnrichedOpportunity[] = [];
  generation = 0;
  insights: string[] = [];

  private sub?: Subscription;

  constructor(
    private rtExecution: RealTimeExecutionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.rtExecution.enriched$.subscribe(items => {
      const snap = this.rtExecution.snapshot();
      this.generation = snap?.nanoScanGeneration ?? 0;
      this.insights = snap?.summaryInsights ?? [];
      this.feed = items;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  setMode(mode: ExecutionFrameworkMode167): void {
    if (mode === this.executionMode) return;
    this.executionMode = mode;
    this.rtExecution.setExecutionMode(mode);
    this.executionModeChange.emit(mode);
    this.feed = this.rtExecution.visibleEnriched(mode);
    this.cdr.markForCheck();
  }

  onSelect(symbol: string): void {
    this.symbolSelect.emit(symbol);
  }
}
