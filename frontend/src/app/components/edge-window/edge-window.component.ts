import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-edge-window',
  standalone: true,
  templateUrl: './edge-window.component.html',
  styleUrl: './edge-window.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EdgeWindowComponent {
  @Input() halfLifeMinutes: number | null = null;
  @Input() peakEdgeMinutes: number | null = null;
  @Input() signalAgeMinutes: number | null = null;
  @Input() thetaRisk: string | null = null;
  @Input() freshness: string | null = null;

  remainingMinutes(): number {
    const half = this.halfLifeMinutes ?? 30;
    const age = this.signalAgeMinutes ?? 0;
    return Math.max(0, half - age);
  }

  fillPct(): number {
    const half = this.halfLifeMinutes ?? 30;
    if (half <= 0) return 0;
    return Math.max(0, Math.min(100, (this.remainingMinutes() / half) * 100));
  }

  barClass(): string {
    const p = this.fillPct();
    if (p < 25) return 'critical';
    if (p < 55) return 'mid';
    return 'fresh';
  }

  warning(): string | null {
    if (this.thetaRisk === 'HIGH' || this.thetaRisk === 'EXTREME') return 'Theta accelerating';
    if (this.freshness === 'STALE' || this.freshness === 'AGING') return 'Stale setup';
    return null;
  }
}
