import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { EdgeRefinementReportService } from '../../services/signal-intelligence/edge-refinement/edge-refinement-report.service';
import {
  EdgeRefinementReport,
  SimulationPresetId,
  SuppressionSimulationResult
} from '../../services/signal-intelligence/edge-refinement/suppression-validation.models';
import { SIMULATION_PRESETS } from '../../services/signal-intelligence/edge-refinement/suppression-rules.util';

/** Phase 141 — Edge Refinement Lab: suppression validation (advisory only). */
@Component({
  selector: 'app-edge-refinement-lab',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './edge-refinement-lab.component.html',
  styleUrl: './edge-refinement-lab.component.scss'
})
export class EdgeRefinementLabComponent implements OnInit, OnDestroy {
  report: EdgeRefinementReport | null = null;
  selected: SuppressionSimulationResult | null = null;
  loading = false;
  readonly presets = SIMULATION_PRESETS;

  private sub?: Subscription;

  constructor(
    private refinement: EdgeRefinementReportService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.refresh();
    this.sub = this.refinement.report$.subscribe(r => {
      this.report = r;
      if (r && !this.selected) this.selected = r.bestSuppressions[0] ?? r.allSimulations[0] ?? null;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  refresh(): void {
    this.loading = true;
    this.report = this.refinement.refresh();
    this.selected = this.report.bestSuppressions[0] ?? this.report.allSimulations[0] ?? null;
    this.loading = false;
    this.cdr.markForCheck();
  }

  runPreset(id: SimulationPresetId): void {
    this.loading = true;
    this.report = this.refinement.runPreset(id);
    this.selected = this.report.allSimulations[0] ?? null;
    this.loading = false;
    this.cdr.markForCheck();
  }

  clearPreset(): void {
    this.report = this.refinement.clearPreset();
    this.selected = this.report.bestSuppressions[0] ?? null;
    this.cdr.markForCheck();
  }

  selectSim(s: SuppressionSimulationResult): void {
    this.selected = s;
    this.cdr.markForCheck();
  }

  formatR(v: number): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
  }

  formatPct(v: number): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
  }

  verdictClass(v: string): string {
    return v.toLowerCase().replace('_', '-');
  }

  severityClass(s: string): string {
    return s.toLowerCase();
  }

  formatLabel(value: string): string {
    return value.replace(/_/g, ' ');
  }
}
