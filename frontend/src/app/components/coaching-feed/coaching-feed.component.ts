import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CoachingFeedItem } from '../../models/cognition.model';

@Component({
  selector: 'app-coaching-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coaching-feed.component.html',
  styleUrl: './coaching-feed.component.scss'
})
export class CoachingFeedComponent {
  @Input() items: CoachingFeedItem[] = [];
  @Input() collapsed = false;

  toggle(): void {
    this.collapsed = !this.collapsed;
  }
}
