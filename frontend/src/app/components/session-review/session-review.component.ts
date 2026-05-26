import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BehaviorInsight, SessionReview } from '../../models/analytics.model';
import { AiSessionReview, IntelligenceSummary } from '../../models/cognition.model';

@Component({
  selector: 'app-session-review',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session-review.component.html',
  styleUrl: './session-review.component.scss'
})
export class SessionReviewComponent {
  @Input() review: SessionReview | null = null;
  @Input() behavior: BehaviorInsight[] = [];
  @Input() aiReview: AiSessionReview | null = null;
  @Input() summary: IntelligenceSummary | null = null;
  @Input() loading = false;

  hasContent(): boolean {
    return !!(this.review || this.aiReview || this.summary || this.behavior.length);
  }
}
