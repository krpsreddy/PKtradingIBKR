import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WorkspaceModeService, WorkspaceMode } from './workspace-mode.service';

export type TraderOperatingMode = 'EXECUTION' | 'RESEARCH';

const STORAGE_KEY = 'pk-trader-operating-mode';

/**
 * Phase 169 — fast execution vs institutional research within workspace.
 * EXECUTION: low cognitive load — scanner, actions, feed only.
 * RESEARCH: edge lab, robustness, governance, replay analytics.
 */
@Injectable({ providedIn: 'root' })
export class TraderOperatingModeService {
  private readonly modeSubject = new BehaviorSubject<TraderOperatingMode>(this.load());

  readonly mode$ = this.modeSubject.asObservable();

  constructor(private workspace: WorkspaceModeService) {
    this.workspace.mode$.subscribe(ws => {
      if (ws === 'execution' && this.modeSubject.value === 'RESEARCH') {
        this.setMode('EXECUTION', false);
      }
    });
  }

  mode(): TraderOperatingMode {
    return this.modeSubject.value;
  }

  isExecution(): boolean {
    return this.modeSubject.value === 'EXECUTION';
  }

  isResearch(): boolean {
    return this.modeSubject.value === 'RESEARCH';
  }

  setMode(mode: TraderOperatingMode, syncWorkspace = true): void {
    if (this.modeSubject.value === mode) return;
    this.modeSubject.next(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    if (syncWorkspace) {
      this.workspace.setMode(mode === 'EXECUTION' ? 'execution' : 'review');
    }
  }

  toggle(): TraderOperatingMode {
    const next = this.isExecution() ? 'RESEARCH' : 'EXECUTION';
    this.setMode(next);
    return next;
  }

  /** Research-only review tabs hidden in execution operating mode. */
  isResearchTab(tab: string): boolean {
    const researchTabs = new Set([
      'edge-discovery', 'edge-refinement', 'analytics-query', 'playbook-lab', 'symbol-edge'
    ]);
    return researchTabs.has(tab);
  }

  shouldShowReviewTab(tab: string): boolean {
    if (this.isExecution()) return !this.isResearchTab(tab);
    return true;
  }

  private load(): TraderOperatingMode {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ws = localStorage.getItem('pk-workspace-mode') as WorkspaceMode | null;
    if (ws === 'review') return 'RESEARCH';
    return raw === 'RESEARCH' ? 'RESEARCH' : 'EXECUTION';
  }
}
