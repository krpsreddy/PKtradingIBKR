import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SessionPriority } from '../../models/cognition.model';

@Component({
  selector: 'app-session-priority-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-priority-banner.component.html',
  styleUrl: './session-priority-banner.component.scss'
})
export class SessionPriorityBannerComponent {
  @Input() priority: SessionPriority | null = null;

  severityClass(): string {
    return this.priority?.severity ?? 'low';
  }
}
