import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { EXECUTION_STATE_FLOW, ExecutionState } from '../../models/execution-state.model';

@Component({
  selector: 'app-execution-state-banner',
  standalone: true,
  imports: [NgClass],
  templateUrl: './execution-state-banner.component.html',
  styleUrl: './execution-state-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExecutionStateBannerComponent {
  @Input() activeState: ExecutionState = 'WATCHING';
  @Input() compact = false;

  readonly flow = EXECUTION_STATE_FLOW;

  isActive(s: ExecutionState): boolean {
    return s === this.activeState;
  }

  isPast(s: ExecutionState): boolean {
    const ai = this.flow.indexOf(this.activeState);
    const si = this.flow.indexOf(s);
    return si >= 0 && ai >= 0 && si < ai;
  }

  pillClass(s: ExecutionState): string {
    if (this.isActive(s)) return 'active';
    if (this.isPast(s)) return 'past';
    return 'future';
  }
}
