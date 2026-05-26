import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { ProbabilityPoint } from '../../models/probabilistic.model';

@Component({
  selector: 'app-probability-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" [attr.width]="width" [attr.height]="height" class="prob-spark">
      @if (contPath) {
        <path [attr.d]="contPath" class="line cont" />
      }
      @if (failPath) {
        <path [attr.d]="failPath" class="line fail" />
      }
      @if (exhaustPath) {
        <path [attr.d]="exhaustPath" class="line exhaust" />
      }
    </svg>
    <div class="legend">
      <span class="cont">Cont</span>
      <span class="fail">Fail</span>
      <span class="exhaust">Exh</span>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 2px; }
    .prob-spark { display: block; width: 100%; }
    .line { fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .line.cont { stroke: #388bfd; }
    .line.fail { stroke: #f85149; opacity: 0.85; }
    .line.exhaust { stroke: #d29922; opacity: 0.7; stroke-dasharray: 3 2; }
    .legend { display: flex; gap: 8px; font-size: 0.52rem; color: #6e7681; text-transform: uppercase; }
    .legend .cont { color: #58a6ff; }
    .legend .fail { color: #f85149; }
    .legend .exhaust { color: #d29922; }
  `]
})
export class ProbabilitySparklineComponent implements OnChanges {
  @Input() trend: ProbabilityPoint[] = [];
  @Input() exhaustionValues: number[] = [];
  @Input() width = 120;
  @Input() height = 28;

  contPath = '';
  failPath = '';
  exhaustPath = '';

  ngOnChanges(): void {
    this.contPath = this.buildPath(this.trend.map(p => p.continuation));
    this.failPath = this.buildPath(this.trend.map(p => p.failure));
    const exhaust = this.exhaustionValues.length === this.trend.length
      ? this.exhaustionValues
      : this.trend.map((_, i, arr) => 15 + (i / Math.max(1, arr.length - 1)) * 25);
    this.exhaustPath = this.buildPath(exhaust);
  }

  private buildPath(values: number[]): string {
    if (!values.length) return '';
    const pad = 2;
    const w = this.width - pad * 2;
    const h = this.height - pad * 2;
    const step = values.length > 1 ? w / (values.length - 1) : 0;
    return values.map((v, i) => {
      const x = pad + i * step;
      const y = pad + h - (Math.max(0, Math.min(100, v)) / 100) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
}
