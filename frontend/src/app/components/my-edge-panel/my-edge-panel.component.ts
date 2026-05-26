import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BehaviorInsight, TraderEdge } from '../../models/analytics.model';
import { PersonalizedCoaching } from '../../models/cognition.model';

@Component({
  selector: 'app-my-edge-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './my-edge-panel.component.html',
  styleUrl: './my-edge-panel.component.scss'
})
export class MyEdgePanelComponent {
  @Input() edge: TraderEdge | null = null;
  @Input() behavior: BehaviorInsight[] = [];
  @Input() personalized: PersonalizedCoaching | null = null;
}
