import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-sparkline',
  standalone: true,
  template: `<svg [attr.viewBox]="'0 0 ' + width + ' ' + height" class="sparkline" preserveAspectRatio="none"
                   [style.width.px]="width" [style.height.px]="height" [style.opacity]="0.58">
    <polyline [attr.points]="points" [attr.stroke]="strokeColor" fill="none" stroke-width="2"/>
  </svg>`,
  styles: [`
    .sparkline { display: block; }
  `]
})
export class SparklineComponent implements OnChanges {
  @Input() data: number[] = [];
  @Input() trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  @Input() width = 48;
  @Input() height = 18;

  points = '';
  strokeColor = '#8b949e';

  ngOnChanges(): void {
    this.strokeColor = this.trend === 'bullish' ? '#26a69a' : this.trend === 'bearish' ? '#f23645' : '#787b86';
    if (!this.data || this.data.length < 2) {
      this.points = '';
      return;
    }
    const min = Math.min(...this.data);
    const max = Math.max(...this.data);
    const range = max - min || 1;
    const w = this.width;
    const h = this.height;
    this.points = this.data.map((v, i) => {
      const x = (i / (this.data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x},${y}`;
    }).join(' ');
  }
}
