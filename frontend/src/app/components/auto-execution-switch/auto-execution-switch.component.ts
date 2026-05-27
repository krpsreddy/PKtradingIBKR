import { Component, OnInit } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExecutionModeService } from '../../services/execution-mode.service';
import {
  ACTIVE_PAPER_MODES,
  PaperExecutionMode,
  PaperExecutionStatusDto
} from '../../models/paper-execution.model';

@Component({
  selector: 'app-auto-execution-switch',
  standalone: true,
  imports: [NgClass, RouterLink],
  templateUrl: './auto-execution-switch.component.html',
  styleUrl: './auto-execution-switch.component.scss'
})
export class AutoExecutionSwitchComponent implements OnInit {
  mode: PaperExecutionMode = 'OFF';
  status: PaperExecutionStatusDto | null = null;
  readonly modes = ACTIVE_PAPER_MODES;

  constructor(public executionMode: ExecutionModeService) {}

  ngOnInit(): void {
    this.executionMode.bootstrap();
    this.executionMode.mode$.subscribe(m => (this.mode = m));
    this.executionMode.status$.subscribe(s => (this.status = s));
  }

  select(mode: PaperExecutionMode): void {
    this.executionMode.setMode(mode).subscribe();
  }

  safetyLabel(): string {
    if (!this.status) return 'Status unknown';
    if (this.status.safety.allowed) {
      return `Gateway: ${this.status.gatewayMode} · port ${this.status.configuredIbkrPort}`;
    }
    return this.status.safety.reason ?? 'Blocked';
  }

  researchEnabled(): boolean {
    return this.executionMode.researchInfrastructureEnabled;
  }
}
