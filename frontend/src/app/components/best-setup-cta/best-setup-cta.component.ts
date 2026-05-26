import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { SetupCandidate } from '../../models/execution.model';

@Component({
  selector: 'app-best-setup-cta',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './best-setup-cta.component.html',
  styleUrl: './best-setup-cta.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BestSetupCtaComponent {
  @Input() bestSetup!: SetupCandidate;
  @Input() selectedSymbol = '';
  @Input() visible = false;
  @Output() switchTo = new EventEmitter<string>();
  @Output() dismiss = new EventEmitter<void>();

  onSwitch(): void {
    this.switchTo.emit(this.bestSetup.symbol);
  }
}
