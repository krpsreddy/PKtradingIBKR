import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  Type
} from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AutonomousDiscoveryReport, DiscoveredStrategy, ReplayDiscoveryExample } from '../services/signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { AutonomousDiscoverySynthesisService } from '../services/signal-intelligence/autonomous-discovery/autonomous-discovery-synthesis.service';
import { ReplayLaunchIntentService } from '../services/signal-centric-replay/replay-launch-intent.service';
import { SymbolHistoryHydrationStore } from '../ai/services/hydration/symbol-history-hydration.store';
import { SIGNAL_INTELLIGENCE_LOOKBACK_DAYS } from '../models/signal-intelligence.model';
import { ExplainableRegimeExplainerComponent } from '../components/explainable-regime-explainer/explainable-regime-explainer.component';
import { RegimeIntelligence60dComponent } from './regime-intelligence-60d.component';
import { HistoricalBulkDiscoveryComponent } from './historical-bulk-discovery.component';
import { ClusterFamilyRegistryService } from '../services/cluster-family-intelligence/cluster-family-registry.service';
import { ClusterFamily } from '../services/cluster-family-intelligence/cluster-family.models';
import { formatCanonicalRegimeLabel } from '../services/cluster-family-intelligence/cluster-family.models';

export type DiscoveryLabTab =
  | 'bullish-discovery'
  | 'bearish-discovery'
  | 'explainable'
  | 'exit-validation'
  | 'regime-intelligence';

/** Phase 158 — Autonomous Strategy Discovery Lab. */
@Component({
  selector: 'app-autonomous-discovery-lab',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NgComponentOutlet,
    ExplainableRegimeExplainerComponent,
    RegimeIntelligence60dComponent,
    HistoricalBulkDiscoveryComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './autonomous-discovery-lab.component.html',
  styleUrl: './autonomous-discovery-lab.component.scss'
})
export class AutonomousDiscoveryLabComponent implements OnInit, OnDestroy {
  report: AutonomousDiscoveryReport | null = null;
  loading = false;
  loadError: string | null = null;
  selectedStrategy: DiscoveredStrategy | null = null;
  activeTab: DiscoveryLabTab = 'bullish-discovery';
  exitValidationPanel: Type<unknown> | null = null;
  exitPanelLoading = false;
  families: ClusterFamily[] = [];
  readonly lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;

  private sub?: Subscription;

  constructor(
    private discovery: AutonomousDiscoverySynthesisService,
    private replayIntent: ReplayLaunchIntentService,
    private hydrationStore: SymbolHistoryHydrationStore,
    private router: Router,
    private clusterFamilies: ClusterFamilyRegistryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.report = this.discovery.snapshot();
    this.selectedStrategy = this.report?.discoveredStrategies[0] ?? null;
    this.sub = this.discovery.report$.subscribe(r => {
      this.report = r;
      if (r) {
        this.families = this.clusterFamilies.aggregatedFamilies();
        if (!this.selectedStrategy) {
          this.selectedStrategy = r.discoveredStrategies[0] ?? null;
        }
      }
      this.cdr.markForCheck();
    });
    if (this.report) {
      this.families = this.clusterFamilies.aggregatedFamilies();
    }
  }

  private async loadDiscovery(): Promise<void> {
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();
    try {
      const report = await this.discovery.ensureLoadedAndRefresh();
      this.report = report;
      this.families = this.clusterFamilies.aggregatedFamilies();
      this.selectedStrategy = report.discoveredStrategies[0] ?? null;
      if (report.totalEvaluated < 10) {
        this.loadError = 'Not enough evaluated history — open Global Edge Lab, hydrate 60D for watchlist symbols, then Re-mine.';
      }
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : 'Failed to load discovery data';
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  refresh(): void {
    void this.loadDiscovery();
  }

  setTab(tab: DiscoveryLabTab): void {
    this.activeTab = tab;
    if (tab === 'exit-validation') {
      void this.loadExitValidationPanel();
    }
    if (tab === 'explainable' && !this.report && !this.loading) {
      void this.loadDiscovery();
    }
    this.cdr.markForCheck();
  }

  private async loadExitValidationPanel(): Promise<void> {
    if (this.exitValidationPanel || this.exitPanelLoading) return;
    this.exitPanelLoading = true;
    this.cdr.markForCheck();
    try {
      const mod = await import(
        '../components/exit-intelligence-validation-panel/exit-intelligence-validation-panel.component'
      );
      this.exitValidationPanel = mod.ExitIntelligenceValidationPanelComponent;
    } finally {
      this.exitPanelLoading = false;
      this.cdr.markForCheck();
    }
  }

  selectStrategy(s: DiscoveredStrategy): void {
    this.selectedStrategy = s;
    this.cdr.markForCheck();
  }

  examplesForStrategy(strategyId: string): ReplayDiscoveryExample[] {
    return (this.report?.replayExamples ?? []).filter(e => e.strategyId === strategyId);
  }

  reviewExample(ex: ReplayDiscoveryExample): void {
    const plan = {
      signalId: ex.signalId,
      symbol: ex.symbol.toUpperCase(),
      sessionDate: ex.sessionDate,
      replayIndex: 0,
      timestampMs: ex.timestamp,
      openReviewMode: true,
      centerViewport: true,
      pauseReplay: true,
      replayMode: 'REVIEW_SIGNAL' as const
    };
    this.replayIntent.setPending(plan);
    void this.router.navigate(['/replay-lab'], { state: { replayPlan: plan } });
  }

  formatR(v: number): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(1)}R`;
  }

  formatLabel(v: string): string {
    return v.replace(/_/g, ' ');
  }

  confidenceClass(c: string): string {
    return c.toLowerCase();
  }

  hasHydratedHistory(): boolean {
    return this.hydrationStore.all().some(s =>
      s.hydrationStatus === 'READY' || s.hydrationStatus === 'PARTIAL' || s.loadedDays >= 10
    );
  }

  zoneLabel(zone: string): string {
    return zone.replace(/_/g, ' ');
  }

  familyLabel(s: DiscoveredStrategy): string {
    const f = this.clusterFamilies.familyForStrategy(s);
    return f?.displayLabel ?? formatCanonicalRegimeLabel(
      this.clusterFamilies.canonicalRegimeForCluster(s.id) ?? 'INSTITUTIONAL_PERSISTENCE'
    );
  }

  familyMembersLabel(s: DiscoveredStrategy): string {
    const f = this.clusterFamilies.familyForStrategy(s);
    if (!f || f.memberClusterNames.length <= 3) {
      return f?.memberClusterNames.join(', ') ?? '—';
    }
    return `${f.memberClusterNames.slice(0, 3).join(', ')} +${f.memberClusterNames.length - 3}`;
  }
}
