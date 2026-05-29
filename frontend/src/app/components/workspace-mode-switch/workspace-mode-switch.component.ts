import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { WorkspaceMode } from '../../services/workspace-mode.service';

export type ReplayLabTab = 'replay' | 'review' | 'discovery' | 'validation';

@Component({
  selector: 'app-workspace-mode-switch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-mode-switch.component.html',
  styleUrl: './workspace-mode-switch.component.scss'
})
export class WorkspaceModeSwitchComponent {
  @Input() mode: WorkspaceMode = 'execution';
  /** Phase 195 — simplified tabs for Replay Lab research workstation. */
  @Input() researchTabs = false;
  @Input() replayLabTab: ReplayLabTab = 'replay';
  @Output() modeChange = new EventEmitter<WorkspaceMode>();
  @Output() replayLabTabChange = new EventEmitter<ReplayLabTab>();

  select(mode: WorkspaceMode): void {
    if (mode !== this.mode) this.modeChange.emit(mode);
  }

  selectReplayTab(tab: ReplayLabTab): void {
    if (tab !== this.replayLabTab) this.replayLabTabChange.emit(tab);
  }
}
