import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IndicatorSnapshot } from '../models/indicator.model';
import { SystemStatus } from '../models/system-status.model';
import { ActiveSignal, HotMomentumItem, MarketTrend } from '../models/workspace.model';
import { SessionTemperature } from '../models/cognition.model';
import { EmergingSetup } from '../models/refinement.model';
import { TradingSymbol } from '../models/trading-symbol.model';
import { GlobalSymbolSwitcherComponent } from '../components/global-symbol-switcher/global-symbol-switcher.component';

@Component({
  selector: 'app-metrics-bar',
  standalone: true,
  imports: [DecimalPipe, GlobalSymbolSwitcherComponent],
  templateUrl: './metrics-bar.component.html',
  styleUrl: './metrics-bar.component.scss'
})
export class MetricsBarComponent {
  @Input() symbol = 'NVDA';
  @Input() price: number | null = null;
  @Input() indicators: IndicatorSnapshot | null = null;
  @Input() status: SystemStatus | null = null;
  @Input() trendLabel = '—';
  @Input() marketTrend: MarketTrend | null = null;
  @Input() sessionTemperature: SessionTemperature | null = null;
  @Input() disciplineScore: number | null = null;
  @Input() watchlist: TradingSymbol[] = [];
  @Input() recentSymbols: string[] = [];
  @Input() hotMomentum: HotMomentumItem[] = [];
  @Input() emergingSetups: EmergingSetup[] = [];
  @Input() activeSignals: ActiveSignal[] = [];

  @Output() symbolSelected = new EventEmitter<string>();
  @Output() symbolAdded = new EventEmitter<string>();

  regimeClass(): string {
    const r = this.marketTrend?.regime?.toLowerCase() ?? '';
    if (r.includes('bull') || r === 'risk_on') return 'regime-bull';
    if (r.includes('bear') || r === 'risk_off') return 'regime-bear';
    if (r === 'choppy') return 'regime-chop';
    return 'regime-neutral';
  }

  macdLabel(): string {
    if (!this.indicators) return '—';
    return this.indicators.macd > this.indicators.signalLine ? 'Bullish' : 'Bearish';
  }

  macdClass(): string {
    return this.macdLabel() === 'Bullish' ? 'bullish' : 'bearish';
  }

  vwapLabel(): string {
    if (!this.indicators || this.price == null) return '—';
    return this.price >= this.indicators.vwap ? 'Above' : 'Below';
  }

  relVolClass(): string {
    if (!this.indicators) return 'neutral';
    const rv = this.indicators.relativeVolume;
    if (rv > 2) return 'rv-high';
    if (rv > 1.5) return 'rv-mid';
    return 'neutral';
  }

  trendClass(): string {
    if (this.trendLabel.includes('Bullish')) return 'bullish';
    if (this.trendLabel.includes('Bearish')) return 'bearish';
    return 'neutral';
  }
}
