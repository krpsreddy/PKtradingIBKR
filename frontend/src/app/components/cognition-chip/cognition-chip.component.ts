import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CognitionChip } from '../../utils/cognition-chips.util';
import { chipIcon } from '../../utils/cognition-icons.util';

@Component({
  selector: 'app-cognition-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [class]="chip.tone" [title]="chip.title ?? chip.label"><span class="ico">{{ icon() }}</span>{{ chip.label }}</span>`,
  styles: [`
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 0.55rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .ico { font-size: 0.5rem; opacity: 0.9; }
    .positive { color: #3fb950; background: rgba(63, 185, 80, 0.12); box-shadow: 0 0 6px rgba(63, 185, 80, 0.15); }
    .risk { color: #f85149; background: rgba(248, 81, 73, 0.1); }
    .neutral { color: #8b949e; background: rgba(48, 54, 61, 0.45); }
  `]
})
export class CognitionChipComponent {
  @Input({ required: true }) chip!: CognitionChip;

  icon(): string {
    return chipIcon(this.chip.label);
  }
}
