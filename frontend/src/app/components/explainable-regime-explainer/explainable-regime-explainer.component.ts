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
  DiscoveredStrategy
} from '../../services/signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { RegimeExplanationService } from '../../services/explainable-regimes/regime-explanation.service';
import { ExplainableRegimeExplanation } from '../../services/explainable-regimes/explainable-regime.models';
import { BearishRegimeExplanationService } from '../../services/explainable-regimes/bearish/bearish-regime-explanation.service';
import { ExplainableBearishExplanation } from '../../services/explainable-regimes/bearish/bearish-regime.models';
import {
  bearishClusterDisplayName,
  isBearishStrategy
} from '../../services/explainable-regimes/bearish/bearish-cluster-classifier';
import { ExplainabilityLayerService } from '../../services/explainable-regimes/layers/explainability-layer.service';
import { LayeredExplainability } from '../../services/explainable-regimes/layers/explainability-layer.models';
import { formatTriggerDisplay } from '../../services/explainable-regimes/layers/engineering-trigger.util';

export type ExplainabilityMode = 'bullish' | 'bearish';

export interface ExplainerTableRow {
  strategy: DiscoveredStrategy;
  displayName: string;
  layer: LayeredExplainability;
}

/** Phase 170/207/208 — layered dual-sided explainable regime intelligence. */
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

  mode: ExplainabilityMode = 'bullish';
  rows: ExplainerTableRow[] = [];
  activeLayer: LayeredExplainability | null = null;
  debugMode = false;
  showFormulaDebug = false;
  showRawStats = false;
  bridgeNote: string | null = null;
  loadingBearish = false;

  readonly formatTrigger = formatTriggerDisplay;

  constructor(
    readonly explainer: RegimeExplanationService,
    readonly bearishExplainer: BearishRegimeExplanationService,
    private layerService: ExplainabilityLayerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(): void {
    void this.refresh();
  }

  setMode(mode: ExplainabilityMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.showFormulaDebug = false;
    this.showRawStats = false;
    void this.refresh();
  }

  toggleDebug(): void {
    this.debugMode = !this.debugMode;
    this.explainer.setDebugMode(this.debugMode);
    this.bearishExplainer.setDebugMode(this.debugMode);
    void this.refresh();
  }

  selectStrategy(s: DiscoveredStrategy): void {
    const row = this.rows.find(r => r.strategy.id === s.id);
    this.activeLayer = row?.layer ?? null;
    this.cdr.markForCheck();
  }

  formatR(v: number): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}R`;
  }

  triggerPreview(row: ExplainerTableRow): string {
    const passed = row.layer.exactTriggers.filter(t => t.passed).length;
    const total = row.layer.exactTriggers.length;
    return `${passed}/${total} gates`;
  }

  private async refresh(): Promise<void> {
    this.explainer.setDebugMode(this.debugMode);
    this.bearishExplainer.setDebugMode(this.debugMode);
    this.bridgeNote = null;

    if (!this.report?.discoveredStrategies.length && this.mode === 'bullish') {
      this.rows = [];
      this.activeLayer = null;
      this.cdr.markForCheck();
      return;
    }

    let strategies: DiscoveredStrategy[] = [];

    if (this.mode === 'bullish') {
      strategies = (this.report?.discoveredStrategies ?? []).filter(s => !isBearishStrategy(s));
    } else {
      const mined = (this.report?.discoveredStrategies ?? []).filter(isBearishStrategy);
      strategies = mined;
      if (strategies.length < 3) {
        this.loadingBearish = true;
        this.cdr.markForCheck();
        const bridged = await this.bearishExplainer.strategiesFromBearishDiscovery();
        this.loadingBearish = false;
        if (bridged.length) {
          strategies = [...mined, ...bridged.filter(b => !mined.some(m => m.id === b.id))];
          this.bridgeNote = 'Supplemented from Bearish Discovery API (historical regime families).';
        }
      }
    }

    if (!strategies.length) {
      this.rows = [];
      this.activeLayer = null;
      this.cdr.markForCheck();
      return;
    }

    this.rows = strategies.map((s, i) => {
      const ctx = { centroid: s.centroid, breakpoints: s.breakpoints };
      if (this.mode === 'bearish') {
        const ex = this.bearishExplainer.explainStrategy(s, ctx, i);
        return {
          strategy: s,
          displayName: bearishClusterDisplayName(s, i),
          layer: this.layerService.buildBearish(ex, s, ctx)
        };
      }
      const ex = this.explainer.explainStrategy(s, ctx);
      return {
        strategy: s,
        displayName: s.name,
        layer: this.layerService.buildBullish(ex, s, ctx)
      };
    });

    const sel = this.selectedStrategy && strategies.some(s => s.id === this.selectedStrategy!.id)
      ? this.selectedStrategy
      : strategies[0];
    this.activeLayer = this.rows.find(r => r.strategy.id === sel!.id)?.layer ?? this.rows[0]?.layer ?? null;
    this.cdr.markForCheck();
  }
}
