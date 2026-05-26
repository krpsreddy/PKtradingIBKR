import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BottomTabId } from '../../models/analytics.model';

export interface CommandAction {
  id: string;
  label: string;
  shortcut?: string;
  group: string;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss'
})
export class CommandPaletteComponent {
  @Input() open = false;
  @Input() symbol = '';
  @Input() actions: CommandAction[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() actionSelected = new EventEmitter<string>();

  query = '';
  highlight = 0;

  filtered(): CommandAction[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.actions;
    return this.actions.filter(a => a.label.toLowerCase().includes(q));
  }

  close(): void {
    this.query = '';
    this.highlight = 0;
    this.closed.emit();
  }

  pick(id: string): void {
    this.actionSelected.emit(id);
    this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    const items = this.filtered();
    if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); this.highlight = Math.min(this.highlight + 1, items.length - 1); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); this.highlight = Math.max(this.highlight - 1, 0); return; }
    if (event.key === 'Enter' && items[this.highlight]) { event.preventDefault(); this.pick(items[this.highlight].id); }
  }
}
