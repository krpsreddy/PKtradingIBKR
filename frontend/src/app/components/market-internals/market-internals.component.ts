import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MarketTrend } from '../../models/workspace.model';
import { MarketPersonality } from '../../models/cognition.model';
import { SystemStatus } from '../../models/system-status.model';

@Component({
  selector: 'app-market-internals',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './market-internals.component.html',
  styleUrl: './market-internals.component.scss'
})
export class MarketInternalsComponent {
  @Input() marketTrend: MarketTrend | null = null;
  @Input() status: SystemStatus | null = null;
  @Input() personality: MarketPersonality | null = null;

  trendLabel(trend: string): string {
    if (trend === 'bullish') return '▲ Bull';
    if (trend === 'bearish') return '▼ Bear';
    return '— Neutral';
  }

  breadthLabel(): string {
    if (!this.marketTrend) return '—';
    if (this.marketTrend.marketAligned) return 'Aligned';
    if (this.marketTrend.choppy) return 'Choppy';
    return 'Mixed';
  }

  riskLabel(): string {
    if (!this.marketTrend) return '—';
    if (this.marketTrend.riskOn) return 'Risk On';
    if (this.marketTrend.regime === 'RISK_OFF') return 'Risk Off';
    return this.marketTrend.choppy ? 'Caution' : 'Neutral';
  }

  breadthClass(b?: string | null): string {
    if (b === 'STRONG') return 'breadth-strong';
    if (b === 'WEAK') return 'breadth-weak';
    return '';
  }
}
