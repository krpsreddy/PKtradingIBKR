import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AutonomousDiscoveryReport,
  DiscoveredCondition,
  DiscoveredStrategy
} from '../../services/signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { RegimeExplanationService } from '../../services/explainable-regimes/regime-explanation.service';
import { ExplainableRegimeExplanation } from '../../services/explainable-regimes/explainable-regime.models';

export interface ExplainerTableRow {
  strategy: DiscoveredStrategy;
  explanation: ExplainableRegimeExplanation;
  numericConditions: DiscoveredCondition[];
}

/** Phase 170 — WHY THIS ENTRY? explainable regime panel. */
@Component({
  selector: 'app-explainable-regime-explainer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explainable-regime-explainer.component.html',
  styleUrl: './explainable-regime-explainer.component.scss'
})
export class ExplainableRegimeExplainerComponent implements OnChanges {
  @Input() report: AutonomousDiscoveryReport | null = null;
  @Input() selectedStrategy: DiscoveredStrategy | null = null;

  rows: ExplainerTableRow[] = [];
  activeExplanation: ExplainableRegimeExplanation | null = null;
  debugMode = false;

  constructor(
    readonly explainer: RegimeExplanationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(): void {
    this.refresh();
  }

  toggleDebug(): void {
    this.debugMode = !this.debugMode;
    this.explainer.setDebugMode(this.debugMode);
    this.refresh();
  }

  selectStrategy(s: DiscoveredStrategy): void {
    this.activeExplanation = this.explainer.explainStrategy(s, {
      centroid: s.centroid,
      breakpoints: s.breakpoints
    });
    this.cdr.markForCheck();
  }

  formatR(v: number): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}R`;
  }

  private refresh(): void {
    if (!this.report?.discoveredStrategies.length) {
      this.rows = [];
      this.activeExplanation = null;
      this.cdr.markForCheck();
      return;
    }
    this.explainer.setDebugMode(this.debugMode);
    this.rows = this.report.discoveredStrategies.map(s => {
      const ctx = { centroid: s.centroid, breakpoints: s.breakpoints };
      return {
        strategy: s,
        explanation: this.explainer.explainStrategy(s, ctx),
        numericConditions: this.explainer.numericConditionsForStrategy(s, ctx)
      };
    });
    const sel = this.selectedStrategy ?? this.report.discoveredStrategies[0];
    this.activeExplanation = this.explainer.explainStrategy(sel, {
      centroid: sel.centroid,
      breakpoints: sel.breakpoints
    });
    this.cdr.markForCheck();
  }
}
