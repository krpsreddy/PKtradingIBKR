import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  DominantOpportunitySnapshot,
  RankedDominantOpportunity
} from '../../services/dominant-opportunity/dominant-opportunity.models';

@Component({
  selector: 'app-dominant-opportunity-hero',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dominant-opportunity-hero.component.html',
  styleUrl: './dominant-opportunity-hero.component.scss'
})
export class DominantOpportunityHeroComponent {
  @Input() snapshot: DominantOpportunitySnapshot | null = null;
  @Input() selectedSymbol = '';
  @Output() symbolSelect = new EventEmitter<string>();

  select(symbol: string): void {
    this.symbolSelect.emit(symbol);
  }

  dominant(): RankedDominantOpportunity | null {
    return this.snapshot?.dominant ?? null;
  }

  emerging(): RankedDominantOpportunity | null {
    return this.snapshot?.emergingFast ?? null;
  }

  others(): RankedDominantOpportunity[] {
    const snap = this.snapshot;
    if (!snap) return [];
    const skip = new Set([
      snap.dominant?.card.symbol,
      snap.emergingFast?.card.symbol
    ].filter(Boolean) as string[]);
    return snap.topRanked.filter(r => !skip.has(r.card.symbol)).slice(0, 3);
  }

  stateClass(state: string): string {
    return state.toLowerCase().replace(/_/g, '-');
  }

  formatLabel(value: string | null | undefined): string {
    return (value ?? '').replace(/_/g, ' ');
  }
}
