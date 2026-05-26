import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ExitIntelligenceValidationService } from '../../services/exit-intelligence-validation/exit-intelligence-validation.service';
import {
  ExitIntelligenceValidationReport,
  ExitLeaderboardRow,
  ExitModeAggregate,
  RegimeExitComparison
} from '../../services/exit-intelligence-validation/exit-intelligence-validation.models';
import { SIGNAL_INTELLIGENCE_LOOKBACK_DAYS } from '../../models/signal-intelligence.model';

type PanelSection =
  | 'overview'
  | 'regimes'
  | 'clusters'
  | 'leaderboards'
  | 'routing';

/** Phase 180 — exit intelligence validation (research only). */
@Component({
  selector: 'app-exit-intelligence-validation-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './exit-intelligence-validation-panel.component.html',
  styleUrl: './exit-intelligence-validation-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExitIntelligenceValidationPanelComponent implements OnInit, OnDestroy {
  report: ExitIntelligenceValidationReport | null = null;
  running = false;
  progressLabel = '';
  activeSection: PanelSection = 'overview';
  readonly lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly validation: ExitIntelligenceValidationService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.report = this.validation.snapshot();
    this.validation.report$
      .pipe(takeUntil(this.destroy$))
      .subscribe(r => {
        this.report = r;
        this.cdr.markForCheck();
      });
    this.validation.progress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(p => {
        this.progressLabel = p ? `${p.phase} (${p.done}/${p.total})` : '';
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async runValidation(): Promise<void> {
    this.running = true;
    this.cdr.markForCheck();
    try {
      await this.validation.runValidation(this.lookbackDays);
    } finally {
      this.running = false;
      this.cdr.markForCheck();
    }
  }

  setSection(section: PanelSection): void {
    this.activeSection = section;
    this.cdr.markForCheck();
  }

  formatRegime(regime: string): string {
    return regime.replace(/_/g, ' ');
  }

  formatPct(v: number): string {
    return `${v.toFixed(1)}%`;
  }

  formatScore(v: number): string {
    return `${Math.round(v)}`;
  }

  winnerClass(w: string): string {
    if (w === 'AUTONOMOUS_TEMPLATE') return 'win-auto';
    if (w === 'HYBRID') return 'win-hybrid';
    if (w === 'LEGACY_RR') return 'win-legacy';
    return 'win-tie';
  }

  modeRows(report: ExitIntelligenceValidationReport): { label: string; agg: ExitModeAggregate }[] {
    return [
      { label: 'Legacy RR', agg: report.overallLegacy },
      { label: 'Autonomous', agg: report.overallAutonomous },
      { label: 'Hybrid', agg: report.overallHybrid }
    ];
  }

  heatValue(row: RegimeExitComparison, field: 'missed' | 'cont' | 'falseEx'): number {
    if (field === 'missed') return row.autonomous.avgMissedMfePct;
    if (field === 'cont') return row.autonomous.postExitContinuationPct;
    return row.autonomous.falseExhaustionPct;
  }

  heatClass(value: number, invert = false): string {
    const v = invert ? 100 - value : value;
    if (v >= 70) return 'heat-high';
    if (v >= 40) return 'heat-mid';
    return 'heat-low';
  }

  leaderboardTitle(kind: string): string {
    const map: Record<string, string> = {
      premature: 'Most premature exits',
      undercapture: 'Most under-captured continuations',
      secondleg: 'Best second-leg holders',
      falseex: 'False exhaustion leaderboard',
      persistence: 'Persistence override saved',
      targetext: 'Clusters needing target extension'
    };
    return map[kind] ?? kind;
  }

  rowsForLeaderboard(kind: string): ExitLeaderboardRow[] {
    const r = this.report;
    if (!r) return [];
    switch (kind) {
      case 'premature': return r.mostPrematureExits;
      case 'undercapture': return r.mostUnderCapturedContinuations;
      case 'secondleg': return r.bestSecondLegHolders;
      case 'falseex': return r.falseExhaustionLeaderboard;
      case 'persistence': return r.persistenceOverrideSavedRanking;
      case 'targetext': return r.topClustersNeedingTargetExtension;
      default: return [];
    }
  }
}
