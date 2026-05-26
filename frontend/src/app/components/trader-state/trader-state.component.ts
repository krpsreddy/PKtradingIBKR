import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { BehaviorInsight, TraderStateView, deriveTraderState } from '../../models/analytics.model';
import { TraderDiscipline } from '../../models/cognition.model';

@Component({
  selector: 'app-trader-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trader-state.component.html',
  styleUrl: './trader-state.component.scss'
})
export class TraderStateComponent implements OnChanges {
  @Input() behavior: BehaviorInsight[] = [];
  @Input() discipline: TraderDiscipline | null = null;
  state: TraderStateView = deriveTraderState([]);

  ngOnChanges(): void {
    this.state = deriveTraderState(this.behavior);
  }
}
