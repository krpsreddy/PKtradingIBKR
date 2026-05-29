import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReplaySessionReviewSummary } from '../../services/replay-decision-visualization/replay-decision-visualization.models';
import { ReplayCoaching } from '../../models/analytics.model';
import { ReplayProbabilistic } from '../../models/probabilistic.model';

@Component({
  selector: 'app-replay-review-sidebar',
  standalone: true,
  templateUrl: './replay-review-sidebar.component.html',
  styleUrl: './replay-review-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReplayReviewSidebarComponent {
  @Input() symbol = '';
  @Input() regime: string | null = null;
  @Input() lifecycle: string | null = null;
  @Input() entryQuality: string | null = null;
  @Input() exitQuality: string | null = null;
  @Input() continuationCapture: string | null = null;
  @Input() mfe: string | null = null;
  @Input() mae: string | null = null;
  @Input() secondLeg: string | null = null;
  @Input() persistenceQuality: string | null = null;
  @Input() reviewSummary: ReplaySessionReviewSummary | null = null;
  @Input() coaching: ReplayCoaching | null = null;
  @Input() probabilistic: ReplayProbabilistic | null = null;
}
