import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-confidence-bar',
  standalone: true,
  templateUrl: './confidence-bar.component.html',
  styleUrl: './confidence-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfidenceBarComponent {
  @Input() value = 0;
  @Input() label = '';
  @Input() tooltip = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  filledBlocks(): number {
    return Math.round((Math.max(0, Math.min(100, this.value)) / 100) * 10);
  }
}
