import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-capital-preservation-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message) {
      <div class="preserve-banner" [class]="modeClass()">
        <span class="icon">🛡</span>
        <span class="text">{{ message }}</span>
      </div>
    }
  `,
  styles: [`
    .preserve-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: rgba(88, 166, 255, 0.08);
      border: 1px solid rgba(88, 166, 255, 0.25);
      color: #8b949e;
    }
    .mode-preserve, .mode-no-edge { color: #58a6ff; border-color: rgba(88, 166, 255, 0.35); }
    .mode-wait, .mode-do-nothing { color: #8b949e; }
    .icon { opacity: 0.85; }
  `]
})
export class CapitalPreservationBannerComponent {
  @Input() mode: string | null = null;
  @Input() message: string | null = null;

  modeClass(): string {
    const m = (this.mode ?? '').toLowerCase();
    if (m.includes('preserve')) return 'mode-preserve';
    if (m.includes('no_edge')) return 'mode-no-edge';
    if (m.includes('wait')) return 'mode-wait';
    return 'mode-do-nothing';
  }
}
