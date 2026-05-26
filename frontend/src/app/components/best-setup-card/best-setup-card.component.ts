import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SetupCandidate } from '../../models/execution.model';
import { MarketTrend } from '../../models/workspace.model';
import { ConfidenceBarComponent } from '../confidence-bar/confidence-bar.component';
import { ConfidenceBadgeComponent } from '../confidence-badge/confidence-badge.component';
import { computeAttentionScore } from '../../utils/attention-score.util';
import { computeSignalHealth } from '../../utils/signal-health.util';
import { computeAttentionPriority } from '../../utils/attention-priority.util';
import { signalAccentClass } from '../../utils/context-emphasis.util';
import { SidebarRowOverflowResolver } from '../../services/sidebar-row-overflow.resolver';

@Component({
  selector: 'app-best-setup-card',
  standalone: true,
  imports: [DecimalPipe, ConfidenceBarComponent, ConfidenceBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './best-setup-card.component.html',
  styleUrl: './best-setup-card.component.scss'
})
export class BestSetupCardComponent {
  @Input({ required: true }) setup!: SetupCandidate;
  @Input() marketTrend: MarketTrend | null = null;
  @Input() winRatePercent: number | null = null;
  @Input() weak = false;
  @Output() selectSetup = new EventEmitter<string>();

  constructor(private rowOverflow: SidebarRowOverflowResolver) {}

  attentionScore(): number {
    return computeAttentionPriority(this.setup, this.marketTrend, 0).score;
  }

  healthClass(): string {
    return computeSignalHealth(this.setup).cssClass;
  }

  healthLabel(): string {
    return computeSignalHealth(this.setup).label;
  }

  accentClass(): string {
    return signalAccentClass(this.setup.signalType);
  }

  displayType(type: string): string {
    if (type === 'OPEN_MOM_BUY') return 'OPEN MOM';
    if (type === 'CONT_BUY' || type === 'CONT_READY') return 'CONT';
    if (type === 'WATCH') return 'WATCH';
    return type.replace(/_/g, ' ');
  }

  freshnessLabel(): string {
    if (!this.setup.freshness) return '—';
    if (this.setup.freshness === 'FRESH') return 'NEW';
    return this.setup.freshnessLabel ?? this.setup.freshness;
  }

  hasOptionsRisk(): boolean {
    return !!(this.setup.extended || (this.setup.optionsWarnings?.length ?? 0) > 0);
  }

  regimeLabel(): string {
    if (!this.marketTrend?.regime) return '—';
    return this.setup.regimeAligned ? `${this.marketTrend.regime} ✓` : this.marketTrend.regime;
  }

  mtfResolved() {
    if (!this.setup.mtfSummary) return null;
    return this.rowOverflow.resolveMtfSummary(this.setup.mtfSummary, 260);
  }
}
