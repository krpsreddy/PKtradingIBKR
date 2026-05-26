import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RankingExplanation } from '../../models/analytics.model';
import { translateAutonomousMessage } from '../../utils/autonomous-terminology.util';

@Component({
  selector: 'app-ranking-explain',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items.length) {
      <div class="ranking-explain">
        <h5>Adaptive regime ranking</h5>
        @for (r of items; track r.message) {
          <div class="row" [class]="r.type">{{ icon(r.type) }} {{ translate(r.message) }}</div>
        }
      </div>
    }
  `,
  styles: [`
    .ranking-explain { padding: 6px 0; }
    h5 { margin: 0 0 4px; font-size: 0.58rem; text-transform: uppercase; color: #6e7681; letter-spacing: 0.04em; }
    .row { font-size: 0.65rem; color: #8b949e; padding: 2px 0; line-height: 1.35; }
    .boost { color: #3fb950; }
    .downgrade { color: #d29922; }
    .neutral { color: #8b949e; opacity: 0.85; }
  `]
})
export class RankingExplainComponent {
  @Input() items: RankingExplanation[] = [];

  translate(message: string): string {
    return translateAutonomousMessage(message);
  }

  icon(type: string): string {
    if (type === 'boost') return '↑';
    if (type === 'downgrade') return '↓';
    return '·';
  }
}
