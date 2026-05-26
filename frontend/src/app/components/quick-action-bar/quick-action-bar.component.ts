import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-quick-action-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quick-action-bar.component.html',
  styleUrl: './quick-action-bar.component.scss'
})
export class QuickActionBarComponent {
  @Input() symbol = '';
  @Input() pinned = false;
  @Output() focusSymbol = new EventEmitter<string>();
  @Output() pinSymbol = new EventEmitter<string>();
  @Output() openReplay = new EventEmitter<string>();
  @Output() scrollTimeline = new EventEmitter<void>();
}
