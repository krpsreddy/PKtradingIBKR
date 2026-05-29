import { AsyncPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ReplayPerformanceDiagnosticsService } from '../../services/replay-performance/replay-performance-diagnostics.service';

@Component({
  selector: 'app-replay-performance-panel',
  standalone: true,
  imports: [AsyncPipe, DecimalPipe],
  templateUrl: './replay-performance-panel.component.html',
  styleUrl: './replay-performance-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReplayPerformancePanelComponent {
  readonly diag$;
  readonly visible = (environment as { showNetworkDiagnostics?: boolean }).showNetworkDiagnostics !== false;

  constructor(diagnostics: ReplayPerformanceDiagnosticsService) {
    this.diag$ = diagnostics.snapshot$;
  }
}
