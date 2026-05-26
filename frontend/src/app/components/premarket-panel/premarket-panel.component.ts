import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { PremarketBrief } from '../../models/cognition.model';

@Component({
  selector: 'app-premarket-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './premarket-panel.component.html',
  styleUrl: './premarket-panel.component.scss'
})
export class PremarketPanelComponent {
  @Input() brief: PremarketBrief | null = null;
}
