import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SetupNarrative, VisualEmphasis } from '../../models/cognition.model';

@Component({
  selector: 'app-setup-narrative',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './setup-narrative.component.html',
  styleUrl: './setup-narrative.component.scss'
})
export class SetupNarrativeComponent {
  @Input() narrative: SetupNarrative | null = null;
  @Input() emphasis: VisualEmphasis | null = null;

  emphasisClass(): string {
    return this.emphasis?.highPriorityTarget === 'setup-narrative'
      ? (this.emphasis.highPriorityClass ?? '')
      : '';
  }
}
