import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IntelligenceEvent } from '../../models/cognition.model';

@Component({
  selector: 'app-intelligence-stream',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './intelligence-stream.component.html',
  styleUrl: './intelligence-stream.component.scss'
})
export class IntelligenceStreamComponent {
  @Input() events: IntelligenceEvent[] = [];
  @Input() collapsed = true;

  toggle(): void {
    this.collapsed = !this.collapsed;
  }
}
