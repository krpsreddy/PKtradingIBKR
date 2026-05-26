import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  ConfidenceLevel,
  SignalEdgeIntelligenceSnapshot
} from '../../models/signal-intelligence.model';
import { formatAutonomousRegime } from '../../utils/autonomous-terminology.util';

@Component({
  selector: 'app-signal-intelligence-panel',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './signal-intelligence-panel.component.html',
  styleUrl: './signal-intelligence-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignalIntelligencePanelComponent {
  @Input() analytics: SignalEdgeIntelligenceSnapshot | null = null;
  @Input() compact = false;

  formatSetup(label: string | undefined | null): string {
    if (!label) return '—';
    return formatAutonomousRegime(label, label);
  }

  formatRegime(label: string | undefined | null): string {
    return this.formatSetup(label);
  }

  signedR(v: number): string {
    const sign = v > 0 ? '+' : '';
    return `${sign}${v.toFixed(2)}R`;
  }

  absR(v: number): number {
    return Math.abs(v);
  }

  confidenceClass(level: ConfidenceLevel | undefined): string {
    switch (level) {
      case 'VERY_HIGH': return 'conf-very-high';
      case 'HIGH': return 'conf-high';
      case 'MEDIUM': return 'conf-medium';
      default: return 'conf-low';
    }
  }
}
