import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { GlobalSymbolSwitcherComponent } from '../global-symbol-switcher/global-symbol-switcher.component';
import { TradingSymbol } from '../../models/trading-symbol.model';
import { MarketTrend } from '../../models/workspace.model';
import { ReplaySpeed } from '../../models/replay.model';

@Component({
  selector: 'app-replay-lab-header',
  standalone: true,
  imports: [DecimalPipe, GlobalSymbolSwitcherComponent],
  templateUrl: './replay-lab-header.component.html',
  styleUrl: './replay-lab-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReplayLabHeaderComponent {
  @Input() symbol = '';
  @Input() price: number | null = null;
  @Input() regime: string | null = null;
  @Input() lifecycle: string | null = null;
  @Input() replayTimestamp: string | null = null;
  @Input() replaySpeed: ReplaySpeed = 1;
  @Input() dominance: number | null = null;
  @Input() persistence: number | null = null;
  @Input() watchlist: TradingSymbol[] = [];
  @Input() recentSymbols: string[] = [];

  @Output() symbolSelected = new EventEmitter<string>();
  @Output() symbolAdded = new EventEmitter<string>();
}
