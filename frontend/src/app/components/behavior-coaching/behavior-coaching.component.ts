import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { BehaviorInsight } from '../../models/analytics.model';

@Component({
  selector: 'app-behavior-coaching',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (insights.length) {
      <div class="behavior-coaching">
        @for (b of insights; track b.title) {
          <div class="card" [class]="severity(b.type)">⚠ {{ b.title }}<span>{{ b.detail }}</span></div>
        }
      </div>
    }
  `,
  styles: [`
    .behavior-coaching { display: flex; flex-direction: column; gap: 4px; padding: 4px 0; }
    .card {
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 0.68rem;
      font-weight: 600;
      border: 1px solid #30363d;
      background: rgba(22, 27, 34, 0.6);
      opacity: 0.9;
    }
    .card span { display: block; font-weight: 400; font-size: 0.62rem; color: #8b949e; margin-top: 2px; }
    .warn-high { color: #f85149; border-color: rgba(248, 81, 73, 0.25); }
    .warn-mid { color: #d29922; border-color: rgba(210, 153, 34, 0.25); }
    .warn-good { color: #3fb950; border-color: rgba(63, 185, 80, 0.25); }
  `]
})
export class BehaviorCoachingComponent {
  @Input() insights: BehaviorInsight[] = [];

  severity(type: string): string {
    const t = type?.toUpperCase() ?? '';
    if (t.includes('CHASE') || t.includes('REVENGE') || t.includes('LATE')) return 'warn-high';
    if (t.includes('EDGE') || t.includes('DISCIPLINE')) return 'warn-good';
    return 'warn-mid';
  }
}
