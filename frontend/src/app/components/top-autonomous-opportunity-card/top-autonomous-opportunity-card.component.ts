import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ScannerOpportunityCard } from '../../services/autonomous-regime-scanner/autonomous-regime-scanner.models';
import { EnrichedOpportunity } from '../../services/execution-intelligence/enriched-opportunity.model';
import { AutonomousExecutionCardComponent } from '../autonomous-execution-card/autonomous-execution-card.component';

/** Phase 166/169 — top opportunity card fed by nano scanner + calibration. */
@Component({
  selector: 'app-top-autonomous-opportunity-card',
  standalone: true,
  imports: [AutonomousExecutionCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './top-autonomous-opportunity-card.component.html',
  styleUrl: './top-autonomous-opportunity-card.component.scss'
})
export class TopAutonomousOpportunityCardComponent {
  @Input() card: ScannerOpportunityCard | null = null;
  @Input() enriched: EnrichedOpportunity | null = null;
  @Input() selected = false;
  @Output() symbolSelect = new EventEmitter<string>();

  displayCard(): ScannerOpportunityCard | null {
    if (this.enriched) {
      return this.card ?? {
        symbol: this.enriched.symbol,
        opportunityType: this.enriched.opportunityType as ScannerOpportunityCard['opportunityType'],
        action: this.enriched.primaryAction.primaryAction as ScannerOpportunityCard['action'],
        tone: this.enriched.tone,
        badge: this.enriched.badge,
        convictionScore: this.enriched.convictionScore,
        expansionProbability: 0,
        continuationPersistence: this.enriched.persistenceScore,
        triggerIntegrity: 0,
        institutionalPressure: 0,
        exhaustionProbability: 0,
        executionQuality: 0,
        entryZoneLabel: this.enriched.entryZoneLabel,
        riskLabel: this.enriched.riskLabel,
        whyNow: this.enriched.whyNow,
        windowLabel: '',
        rvolLabel: '',
        popVelocity: this.enriched.popVelocity,
        isRising: this.enriched.isRising,
        rank: this.enriched.rank,
        executionPlan: this.enriched.executionPlan ?? undefined
      };
    }
    return this.card;
  }

  onSelect(symbol: string): void {
    this.symbolSelect.emit(symbol);
  }
}
