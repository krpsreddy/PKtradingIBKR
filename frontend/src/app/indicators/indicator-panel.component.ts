import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { IndicatorSnapshot } from '../models/indicator.model';

@Component({
  selector: 'app-indicator-panel',
  standalone: true,
  imports: [MatCardModule, DecimalPipe],
  templateUrl: './indicator-panel.component.html',
  styleUrl: './indicator-panel.component.scss'
})
export class IndicatorPanelComponent {
  @Input() indicators: IndicatorSnapshot | null = null;

  trendClass(value: number, ref: number): string {
    if (value > ref) return 'bullish';
    if (value < ref) return 'bearish';
    return 'neutral';
  }

  macdClass(): string {
    if (!this.indicators) return 'neutral';
    return this.indicators.macd > this.indicators.signalLine ? 'bullish' : 'bearish';
  }

  rsiClass(): string {
    if (!this.indicators) return 'neutral';
    if (this.indicators.rsi > 55) return 'bullish';
    if (this.indicators.rsi < 45) return 'bearish';
    return 'neutral';
  }

  relVolClass(): string {
    if (!this.indicators) return 'neutral';
    if (this.indicators.relativeVolume > 1.5) return 'bullish';
    return 'neutral';
  }
}
