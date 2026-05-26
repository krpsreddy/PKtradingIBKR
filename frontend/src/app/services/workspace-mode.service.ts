import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type WorkspaceMode = 'execution' | 'review';

export type ReviewTabId =
  | 'intelligence'
  | 'edge-lab'
  | 'symbol-dna'
  | 'symbol-edge'
  | 'edge-discovery'
  | 'session'
  | 'journal'
  | 'edge'
  | 'coaching'
  | 'playbooks'
  | 'playbook-lab'
  | 'trade-timeline'
  | 'edge-refinement'
  | 'signal-explorer'
  | 'analytics-query'
  | 'history';

const STORAGE_KEY = 'pk-workspace-mode';

@Injectable({ providedIn: 'root' })
export class WorkspaceModeService {
  private readonly modeSubject = new BehaviorSubject<WorkspaceMode>(this.load());
  readonly mode$ = this.modeSubject.asObservable();
  private pendingReviewTab: ReviewTabId | null = null;

  mode(): WorkspaceMode {
    return this.modeSubject.value;
  }

  isExecution(): boolean {
    return this.modeSubject.value === 'execution';
  }

  isReview(): boolean {
    return this.modeSubject.value === 'review';
  }

  setMode(mode: WorkspaceMode): void {
    if (this.modeSubject.value === mode) return;
    this.modeSubject.next(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  toggle(): WorkspaceMode {
    const next: WorkspaceMode = this.isExecution() ? 'review' : 'execution';
    this.setMode(next);
    return next;
  }

  openReview(tab: ReviewTabId = 'intelligence'): void {
    this.pendingReviewTab = tab;
    this.setMode('review');
  }

  consumeReviewTab(): ReviewTabId | null {
    const tab = this.pendingReviewTab;
    this.pendingReviewTab = null;
    return tab;
  }

  private load(): WorkspaceMode {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'review' ? 'review' : 'execution';
  }
}
