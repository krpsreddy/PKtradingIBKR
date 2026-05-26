import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { EnrichedOpportunity } from '../../services/execution-intelligence/enriched-opportunity.model';
import { ExecutionLifecycleBarComponent } from '../execution-lifecycle-bar/execution-lifecycle-bar.component';
import { stageLabel } from '../../services/execution-lifecycle/execution-lifecycle.engine';

/** Phase 167/169 — calibrated feed row with dominant action + lifecycle. */
@Component({
  selector: 'app-live-execution-feed-row',
  standalone: true,
  imports: [ExecutionLifecycleBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-execution-feed-row.component.html',
  styleUrl: './live-execution-feed-row.component.scss'
})
export class LiveExecutionFeedRowComponent {
  @Input({ required: true }) enriched!: EnrichedOpportunity;
  @Input() selected = false;
  @Input() rankIndex = 0;
  @Output() symbolSelect = new EventEmitter<string>();

  toneClass(): string {
    return `tone-${this.enriched.tone.toLowerCase()}`;
  }

  rising(): boolean {
    return this.enriched.isRising;
  }

  maturity(): string {
    return stageLabel(this.enriched.lifecycle.currentStageId);
  }

  onClick(): void {
    this.symbolSelect.emit(this.enriched.symbol);
  }
}
