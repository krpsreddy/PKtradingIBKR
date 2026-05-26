import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LifecycleCoachSnapshot } from '../../services/signal-intelligence/trade-lifecycle/trade-lifecycle.models';

/** Phase 140 — compact execution coaching panel (advisory only). */
@Component({
  selector: 'app-execution-coaching-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './execution-coaching-panel.component.html',
  styleUrl: './execution-coaching-panel.component.scss'
})
export class ExecutionCoachingPanelComponent {
  @Input() coach: LifecycleCoachSnapshot | null = null;

  healthClass(h: string): string {
    return h.toLowerCase().replace('_', '-');
  }

  stateClass(s: string): string {
    return s.toLowerCase();
  }

  severityClass(s: string): string {
    return s.toLowerCase();
  }

  formatFailure(reason: string | null): string {
    return reason ? reason.replace(/_/g, ' ') : '';
  }
}
