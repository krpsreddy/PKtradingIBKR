import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-discipline-banner',
  standalone: true,
  template: `
    @if (visible) {
      <div class="discipline-banner" [class.subtle]="subtle">
        <span class="icon">◆</span>
        <span class="text">{{ message }}</span>
      </div>
    }
  `,
  styles: [`
    .discipline-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 12px 10px;
      margin-bottom: 4px;
      background: rgba(19, 23, 34, 0.55);
      border-bottom: 1px solid rgba(48, 54, 61, 0.12);
      font-size: var(--typo-guidance-min, 0.6875rem);
      font-weight: 400;
      letter-spacing: 0.08em;
      line-height: 1.3;
      text-transform: uppercase;
      color: #8b949e;
      opacity: var(--typo-guidance-opacity, 0.48);
    }
    .icon { color: #6e7681; opacity: 0.35; }
    .subtle { opacity: var(--typo-guidance-opacity, 0.48); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DisciplineBannerComponent {
  @Input() visible = false;
  @Input() message = 'DISCIPLINED WAIT · WAITING FOR HIGH-CONVICTION EXPANSION';
  @Input() subtle = true;
}
