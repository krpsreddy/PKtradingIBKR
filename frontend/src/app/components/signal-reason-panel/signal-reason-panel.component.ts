import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SignalConditions } from '../../utils/signal-conditions.util';

@Component({
  selector: 'app-signal-reason-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signal-reason-panel.component.html',
  styleUrl: './signal-reason-panel.component.scss'
})
export class SignalReasonPanelComponent {
  @Input() symbol = '';
  @Input() signalType = '';
  @Input() conditions: SignalConditions | null = null;
  @Input() collapsed = false;
}
