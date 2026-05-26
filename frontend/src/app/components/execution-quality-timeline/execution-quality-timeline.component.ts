import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ExecutionQualityPoint } from '../../models/refinement.model';

@Component({
  selector: 'app-execution-quality-timeline',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './execution-quality-timeline.component.html',
  styleUrl: './execution-quality-timeline.component.scss'
})
export class ExecutionQualityTimelineComponent {
  @Input() symbol = '';
  @Input() points: ExecutionQualityPoint[] = [];

  track(index: number, p: ExecutionQualityPoint): string {
    return `${index}-${p.timestamp}-${p.label}-${p.score ?? p.grade ?? ''}`;
  }
}
