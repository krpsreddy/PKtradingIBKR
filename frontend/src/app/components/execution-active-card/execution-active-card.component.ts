import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssistedPositionView } from '../../services/assisted-exit-intelligence/assisted-exit.models';

@Component({
  selector: 'app-execution-active-card',
  standalone: true,
  imports: [NgClass, DecimalPipe, FormsModule],
  templateUrl: './execution-active-card.component.html',
  styleUrl: './execution-active-card.component.scss'
})
export class ExecutionActiveCardComponent {
  @Input({ required: true }) view!: AssistedPositionView;
  @Input() exitPrice = '';
  @Output() exitPriceChange = new EventEmitter<string>();
  @Output() manualClose = new EventEmitter<void>();

  toneClass(): string {
    return this.view.healthTone.toLowerCase();
  }

  onExitInput(v: string): void {
    this.exitPriceChange.emit(v);
  }
}
