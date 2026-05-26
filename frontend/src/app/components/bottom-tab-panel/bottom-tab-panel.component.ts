import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { BottomTabId } from '../../models/analytics.model';

export interface BottomTabDef {
  id: BottomTabId;
  label: string;
  count?: number;
  hidden?: boolean;
}

@Component({
  selector: 'app-bottom-tab-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-tab-panel.component.html',
  styleUrl: './bottom-tab-panel.component.scss'
})
export class BottomTabPanelComponent {
  @Input() tabs: BottomTabDef[] = [];
  @Input() activeTab: BottomTabId | null = null;
  @Input() expanded = false;
  @Output() tabChange = new EventEmitter<BottomTabId>();
  @Output() toggleExpand = new EventEmitter<void>();

  visibleTabs(): BottomTabDef[] {
    return this.tabs.filter(t => !t.hidden);
  }

  selectTab(id: BottomTabId): void {
    this.tabChange.emit(id);
  }

  label(t: BottomTabDef): string {
    return t.count != null ? `${t.label} (${t.count})` : t.label;
  }
}
