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
import { Subscription } from 'rxjs';
import { TradeLifecycleService } from '../../services/signal-intelligence/trade-lifecycle/trade-lifecycle.service';
import {
  LifecycleCoachingInsight,
  OutcomeAttributionRow,
  TradeLifecycleIntelligenceSnapshot,
  TradeLifecycleSnapshot
} from '../../services/signal-intelligence/trade-lifecycle/trade-lifecycle.models';
import { formatReviewLabel } from '../../utils/autonomous-terminology.util';

/** Phase 140 — Trade Timeline + lifecycle attribution lab (advisory only). */
@Component({
  selector: 'app-trade-lifecycle-lab',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trade-lifecycle-lab.component.html',
  styleUrl: './trade-lifecycle-lab.component.scss'
})
export class TradeLifecycleLabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() symbol = 'NVDA';

  snapshot: TradeLifecycleIntelligenceSnapshot | null = null;
  selected: TradeLifecycleSnapshot | null = null;
  loading = false;

  private sub?: Subscription;

  constructor(
    private lifecycle: TradeLifecycleService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.refresh();
    this.sub = this.lifecycle.snapshot$.subscribe(s => {
      this.snapshot = s;
      if (s && !this.selected) this.selected = s.trades[0] ?? null;
      this.cdr.markForCheck();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['symbol'] && !changes['symbol'].firstChange) {
      this.refresh();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  refresh(): void {
    this.loading = true;
    this.snapshot = this.lifecycle.forSymbol(this.symbol);
    this.selected = this.snapshot.trades[0] ?? null;
    this.loading = false;
    this.cdr.markForCheck();
  }

  selectTrade(t: TradeLifecycleSnapshot): void {
    this.selected = t;
    this.cdr.markForCheck();
  }

  healthClass(h: string): string {
    return h.toLowerCase().replace('_', '-');
  }

  stateClass(s: string): string {
    return s.toLowerCase();
  }

  severityClass(s: LifecycleCoachingInsight['severity']): string {
    return s.toLowerCase();
  }

  formatR(v: number): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
  }

  formatPct(v: number): string {
    return `${v}%`;
  }

  attributionFor(t: TradeLifecycleSnapshot): OutcomeAttributionRow | undefined {
    return this.snapshot?.attributions.find(a => a.signalId === t.signalId);
  }

  formatFailure(reason: string | null): string {
    return reason ? reason.replace(/_/g, ' ') : '';
  }

  formatEntryLocation(loc: string): string {
    return loc.replace(/_/g, ' ');
  }

  formatOpportunity(type: string | null | undefined): string {
    return formatReviewLabel(type);
  }
}
