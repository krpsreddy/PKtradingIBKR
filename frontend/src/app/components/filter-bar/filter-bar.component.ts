import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { WorkflowFilterKey, WorkflowFilters } from '../../models/workflow-filters.model';

interface FilterChip {
  key: WorkflowFilterKey;
  label: string;
}

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filter-bar.component.html',
  styleUrl: './filter-bar.component.scss'
})
export class FilterBarComponent {
  @Input({ required: true }) filters!: WorkflowFilters;
  @Output() filtersChange = new EventEmitter<WorkflowFilters>();

  readonly chips: FilterChip[] = [
    { key: 'earlyExpansionOnly', label: 'Early Expansion' },
    { key: 'persistenceOnly', label: 'Persistence' },
    { key: 'healthyPullbackOnly', label: 'Healthy Pullback' },
    { key: 'vwapAcceptanceOnly', label: 'VWAP Acceptance' },
    { key: 'compressionReadyOnly', label: 'Compression Ready' },
    { key: 'highVelocityOnly', label: 'High Velocity' },
    { key: 'confirmedOnly', label: 'Confirmed' },
    { key: 'developingOnly', label: 'Developing' },
    { key: 'exhaustionRiskOnly', label: 'Exhaustion Risk' },
    { key: 'failedExpansionOnly', label: 'Failed Expansion' },
    { key: 'regimeTransitionOnly', label: 'Regime Transition' },
    { key: 'freshOnly', label: 'Fresh' },
    { key: 'highRvolOnly', label: 'High Participation' },
    { key: 'mtfAlignedOnly', label: 'MTF Aligned' },
    { key: 'bullishOnly', label: 'Bullish' },
    { key: 'bearishOnly', label: 'Bearish' }
  ];

  toggle(key: WorkflowFilterKey): void {
    const next = { ...this.filters, [key]: !this.filters[key] };
    if (key === 'bullishOnly' && next.bullishOnly) next.bearishOnly = false;
    if (key === 'bearishOnly' && next.bearishOnly) next.bullishOnly = false;
    if (key === 'confirmedOnly' && next.confirmedOnly) next.developingOnly = false;
    if (key === 'developingOnly' && next.developingOnly) next.confirmedOnly = false;
    this.filtersChange.emit(next);
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
