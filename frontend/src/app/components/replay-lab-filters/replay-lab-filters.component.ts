import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { WorkflowFilterKey, WorkflowFilters } from '../../models/workflow-filters.model';

interface PrimaryChip {
  key: WorkflowFilterKey;
  label: string;
}

@Component({
  selector: 'app-replay-lab-filters',
  standalone: true,
  templateUrl: './replay-lab-filters.component.html',
  styleUrl: './replay-lab-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReplayLabFiltersComponent {
  @Input({ required: true }) filters!: WorkflowFilters;
  @Output() filtersChange = new EventEmitter<WorkflowFilters>();

  advancedOpen = signal(false);

  readonly primary: PrimaryChip[] = [
    { key: 'bullishOnly', label: 'Bull Regime' },
    { key: 'bearishOnly', label: 'Bear Regime' },
    { key: 'persistenceOnly', label: 'Lifecycle: Persist' },
    { key: 'developingOnly', label: 'Lifecycle: Develop' },
    { key: 'confirmedOnly', label: 'Entry Quality' },
    { key: 'exhaustionRiskOnly', label: 'Exit: Exhaust' },
    { key: 'failedExpansionOnly', label: 'Exit: Failed' },
    { key: 'freshOnly', label: 'Session: Fresh' }
  ];

  readonly advanced: PrimaryChip[] = [
    { key: 'earlyExpansionOnly', label: 'Early Expansion' },
    { key: 'healthyPullbackOnly', label: 'Healthy Pullback' },
    { key: 'vwapAcceptanceOnly', label: 'VWAP Acceptance' },
    { key: 'compressionReadyOnly', label: 'Compression' },
    { key: 'highVelocityOnly', label: 'High Velocity' },
    { key: 'highRvolOnly', label: 'High RVOL' },
    { key: 'mtfAlignedOnly', label: 'MTF Aligned' },
    { key: 'regimeTransitionOnly', label: 'Regime Transition' }
  ];

  toggle(key: WorkflowFilterKey): void {
    const next = { ...this.filters, [key]: !this.filters[key] };
    if (key === 'bullishOnly' && next.bullishOnly) next.bearishOnly = false;
    if (key === 'bearishOnly' && next.bearishOnly) next.bullishOnly = false;
    this.filtersChange.emit(next);
  }

  toggleAdvanced(): void {
    this.advancedOpen.update(v => !v);
  }

  clear(): void {
    this.filtersChange.emit({
      bullishOnly: false,
      bearishOnly: false,
      freshOnly: false,
      highRvolOnly: false,
      mtfAlignedOnly: false,
      earlyExpansionOnly: false,
      persistenceOnly: false,
      healthyPullbackOnly: false,
      vwapAcceptanceOnly: false,
      compressionReadyOnly: false,
      highVelocityOnly: false,
      confirmedOnly: false,
      developingOnly: false,
      exhaustionRiskOnly: false,
      failedExpansionOnly: false,
      regimeTransitionOnly: false
    });
  }

  anyActive(): boolean {
    return Object.values(this.filters).some(Boolean);
  }
}
