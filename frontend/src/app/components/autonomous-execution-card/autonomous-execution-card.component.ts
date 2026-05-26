import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ScannerOpportunityCard } from '../../services/autonomous-regime-scanner/autonomous-regime-scanner.models';
import { EnrichedOpportunity } from '../../services/execution-intelligence/enriched-opportunity.model';
import { ExecutionLifecycleBarComponent } from '../execution-lifecycle-bar/execution-lifecycle-bar.component';
import { formatEntryZoneRange, formatIdealEntry } from '../../services/execution-plan/execution-plan-labels.util';
import { ExecutionPlan } from '../../services/execution-plan/execution-plan.models';

/** Phase 165/169 — trader-first execution card with dominant action + lifecycle. */
@Component({
  selector: 'app-autonomous-execution-card',
  standalone: true,
  imports: [ExecutionLifecycleBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './autonomous-execution-card.component.html',
  styleUrl: './autonomous-execution-card.component.scss'
})
export class AutonomousExecutionCardComponent {
  @Input({ required: true }) card!: ScannerOpportunityCard;
  @Input() enriched: EnrichedOpportunity | null = null;
  @Input() compact = false;
  @Input() hero = false;
  @Input() selected = false;
  @Input() fadeExhaustion = false;
  @Output() symbolSelect = new EventEmitter<string>();

  toneClass(): string {
    const tone = this.enriched?.tone ?? this.card.tone;
    return `tone-${tone.toLowerCase()}`;
  }

  conviction(): number {
    return this.enriched?.convictionScore ?? this.card.convictionScore;
  }

  primaryLabel(): string {
    return this.enriched?.primaryAction.primaryLabel ?? this.actionLabel();
  }

  secondaryLabel(): string | null {
    return this.enriched?.primaryAction.secondaryLabel ?? null;
  }

  actionClass(): string {
    return this.enriched?.primaryAction.cssClass ?? 'action-hold';
  }

  urgencyPulse(): boolean {
    return (this.enriched?.urgencyScore ?? 0) >= 75 || (this.enriched?.isRising ?? this.card.isRising);
  }

  rarityLabel(): string | null {
    if (!this.enriched) return null;
    const r = this.enriched.percentileRank;
    if (r === 'TOP_1' || r === 'TOP_5' || r === 'TOP_10') return this.enriched.percentileLabel;
    return null;
  }

  actionLabel(): string {
    return this.card.badge.replace(/^[^\s]+\s/, '');
  }

  activePlan(): ExecutionPlan | null | undefined {
    return this.enriched?.executionPlan ?? this.card.executionPlan;
  }

  entryLabel(): string {
    const plan = this.activePlan();
    if (plan) return formatIdealEntry(plan);
    return this.enriched?.entryZoneLabel ?? this.card.entryZoneLabel;
  }

  entryBandLabel(): string | null {
    const plan = this.activePlan();
    if (!plan) return null;
    return formatEntryZoneRange(plan);
  }

  planRr(): number | null {
    const plan = this.activePlan();
    return plan?.riskReward ?? null;
  }

  onClick(): void {
    this.symbolSelect.emit(this.card.symbol);
  }
}
