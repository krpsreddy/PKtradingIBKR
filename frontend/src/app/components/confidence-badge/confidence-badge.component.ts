import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-confidence-badge',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="conf-badge" [class]="tierClass()" [title]="label || ''">
      {{ percent | number:'1.0-0' }}%
      @if (label) { <span class="sub">{{ label }}</span> }
    </span>
  `,
  styles: [`
    .conf-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 0.68rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .sub { font-weight: 500; opacity: 0.85; font-size: 0.62rem; }
    .conf-high { background: rgba(63, 185, 80, 0.18); color: #3fb950; border: 1px solid rgba(63, 185, 80, 0.35); }
    .conf-mid { background: rgba(210, 153, 34, 0.15); color: #d29922; border: 1px solid rgba(210, 153, 34, 0.3); }
    .conf-low { background: rgba(248, 81, 73, 0.12); color: #f85149; border: 1px solid rgba(248, 81, 73, 0.28); }
  `]
})
export class ConfidenceBadgeComponent {
  @Input() percent = 0;
  @Input() label = '';

  tierClass(): string {
    if (this.percent >= 70) return 'conf-high';
    if (this.percent >= 50) return 'conf-mid';
    return 'conf-low';
  }
}
