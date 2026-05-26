import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DecimalPipe, KeyValuePipe } from '@angular/common';
import { PerformanceHeatmap } from '../../models/cognition.model';

@Component({
  selector: 'app-performance-heatmap',
  standalone: true,
  imports: [DecimalPipe, KeyValuePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './performance-heatmap.component.html',
  styleUrl: './performance-heatmap.component.scss'
})
export class PerformanceHeatmapComponent {
  @Input() heatmap: PerformanceHeatmap | null = null;

  cellClass(rate: number): string {
    if (rate >= 0.65) return 'hot';
    if (rate >= 0.5) return 'warm';
    if (rate >= 0.35) return 'cool';
    return 'cold';
  }
}
