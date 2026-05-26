import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Subscription } from 'rxjs';
import { AutonomousRegimeScannerService } from '../../services/autonomous-regime-scanner/autonomous-regime-scanner.service';
import {
  ScannerOpportunityCard,
  ScannerSectionId,
  ScannerSnapshot
} from '../../services/autonomous-regime-scanner/autonomous-regime-scanner.models';
import { AutonomousExecutionCardComponent } from '../autonomous-execution-card/autonomous-execution-card.component';
/** Phase 165 — Autonomous Opportunity Scanner panel. */
@Component({
  selector: 'app-autonomous-scanner-panel',
  standalone: true,
  imports: [CommonModule, ScrollingModule, AutonomousExecutionCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './autonomous-scanner-panel.component.html',
  styleUrl: './autonomous-scanner-panel.component.scss'
})
export class AutonomousScannerPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input() symbols: string[] = [];
  @Output() symbolSelect = new EventEmitter<string>();

  snapshot: ScannerSnapshot | null = null;
  loading = false;
  error: string | null = null;

  readonly sections: { id: ScannerSectionId; title: string }[] = [
    { id: 'HIGH_CONTINUATION', title: 'Highest Conviction Continuations' },
    { id: 'EARLY_EXPANSION', title: 'Early Expansion Opportunities' },
    { id: 'INSTITUTIONAL_PERSISTENCE', title: 'Institutional Persistence Leaders' },
    { id: 'HEALTHY_PULLBACK', title: 'Healthy Pullback Candidates' },
    { id: 'COMPRESSION_BREAKOUT', title: 'Compression Breakout Setups' },
    { id: 'EXHAUSTION_AVOID', title: 'Exhaustion / Avoid List' }
  ];

  private sub?: Subscription;

  constructor(
    private scanner: AutonomousRegimeScannerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.scanner.snapshot$.subscribe(s => {
      this.snapshot = s;
      this.cdr.markForCheck();
    });
    this.refresh(true);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['symbols'] && !changes['symbols'].firstChange) {
      this.refresh(true);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  refresh(force = true): void {
    if (!this.symbols.length) {
      this.snapshot = null;
      return;
    }
    this.loading = true;
    this.error = null;
    this.scanner.scan(this.symbols, force).subscribe({
      next: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.error = 'Scanner unavailable — retry shortly';
        this.cdr.markForCheck();
      }
    });
  }

  sectionCards(id: ScannerSectionId): ScannerOpportunityCard[] {
    if (!this.snapshot) return [];
    switch (id) {
      case 'HIGH_CONTINUATION': return this.snapshot.highContinuation;
      case 'EARLY_EXPANSION': return this.snapshot.earlyExpansion;
      case 'INSTITUTIONAL_PERSISTENCE': return this.snapshot.institutionalPersistence;
      case 'HEALTHY_PULLBACK': return this.snapshot.healthyPullback;
      case 'COMPRESSION_BREAKOUT': return this.snapshot.compressionBreakout;
      case 'EXHAUSTION_AVOID': return this.snapshot.exhaustionAvoid;
    }
  }

  trackCard(_: number, c: ScannerOpportunityCard): string {
    return c.symbol + c.opportunityType;
  }

  onSelect(symbol: string): void {
    this.symbolSelect.emit(symbol);
  }
}
