import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { TradeJournalEntry } from '../../models/refinement.model';
import { formatReviewLabel } from '../../utils/autonomous-terminology.util';

@Component({
  selector: 'app-trade-journal-panel',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trade-journal-panel.component.html',
  styleUrl: './trade-journal-panel.component.scss'
})
export class TradeJournalPanelComponent {
  @Input() entries: TradeJournalEntry[] = [];
  @Input() symbol = '';
  @Input() collapsed = true;
  @Output() toggleCollapse = new EventEmitter<void>();
  @Output() saveEntry = new EventEmitter<TradeJournalEntry>();
  @Output() reviewEntry = new EventEmitter<TradeJournalEntry>();

  draft: TradeJournalEntry = { symbol: '', notes: '' };

  startEntry(): void {
    this.draft = {
      symbol: this.symbol,
      entryTimestamp: new Date().toISOString(),
      notes: ''
    };
  }

  submit(): void {
    if (!this.draft.symbol) return;
    this.saveEntry.emit({ ...this.draft });
    this.draft = { symbol: '', notes: '' };
  }

  attachReplay(entry: TradeJournalEntry): void {
    this.reviewEntry.emit({ ...entry, replayLink: `/replay?symbol=${entry.symbol}` });
  }

  formatSetup(value: string | null | undefined): string {
    return formatReviewLabel(value);
  }
}
