import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NextAction } from '../../services/next-action.service';

@Component({
  selector: 'app-next-action-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './next-action-panel.component.html',
  styleUrl: './next-action-panel.component.scss'
})
export class NextActionPanelComponent {
  @Input() action: NextAction | null = null;
  @Input() aiHint: string | null = null;
  @Input() calmMode = false;
  @Input() intensityMode: import('../../services/situational-intensity.engine').IntensityMode = 'CALM';
  @Input() silenceActive = false;

  toneClass(): string {
    if (this.calmMode || this.silenceActive) return 'tone-wait calm silence';
    return 'tone-' + (this.action?.tone ?? 'wait');
  }

  urgencyClass(): string {
    if (this.calmMode) return 'calm';
    return 'urg-' + (this.action?.urgency ?? 'LOW').toLowerCase();
  }

  shouldEscalate(): boolean {
    return !this.calmMode && this.action?.urgency === 'CRITICAL';
  }
}
