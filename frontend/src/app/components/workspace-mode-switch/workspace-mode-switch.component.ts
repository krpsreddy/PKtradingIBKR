import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { WorkspaceMode } from '../../services/workspace-mode.service';

@Component({
  selector: 'app-workspace-mode-switch',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-mode-switch.component.html',
  styleUrl: './workspace-mode-switch.component.scss'
})
export class WorkspaceModeSwitchComponent {
  @Input() mode: WorkspaceMode = 'execution';
  @Output() modeChange = new EventEmitter<WorkspaceMode>();

  select(mode: WorkspaceMode): void {
    if (mode !== this.mode) this.modeChange.emit(mode);
  }
}
