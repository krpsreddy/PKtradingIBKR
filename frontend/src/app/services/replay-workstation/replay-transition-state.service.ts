import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  DEFAULT_PANEL_LAYOUT,
  ReplayActionFeedback,
  ReplayDebugInfo,
  ReplayPanelLayoutState,
  ReplaySnapRequest,
  ReplayUxStatus,
  REPLAY_SNAP_LOCK_MS,
  REPLAY_UX_DEBOUNCE_MS
} from './replay-ux.models';

export interface ReplayTransitionSnapshot {
  status: ReplayUxStatus;
  feedback: ReplayActionFeedback | null;
  viewportLocked: boolean;
  focusBarIndex: number | null;
  pendingSnap: ReplaySnapRequest | null;
  layout: ReplayPanelLayoutState;
  debug: ReplayDebugInfo | null;
}

const INITIAL: ReplayTransitionSnapshot = {
  status: 'READY',
  feedback: null,
  viewportLocked: false,
  focusBarIndex: null,
  pendingSnap: null,
  layout: { ...DEFAULT_PANEL_LAYOUT },
  debug: null
};

@Injectable({ providedIn: 'root' })
export class ReplayTransitionStateService {
  private readonly stateSubject = new BehaviorSubject<ReplayTransitionSnapshot>({ ...INITIAL });
  readonly state$ = this.stateSubject.asObservable();
  private lockTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  snapshot(): ReplayTransitionSnapshot {
    return this.stateSubject.value;
  }

  setStatus(status: ReplayUxStatus): void {
    this.patch({ status });
  }

  setFeedback(feedback: ReplayActionFeedback | null): void {
    this.patch({ feedback });
  }

  setLayout(layout: ReplayPanelLayoutState): void {
    this.patch({ layout });
  }

  setDebug(debug: ReplayDebugInfo | null): void {
    this.patch({ debug });
  }

  lockViewport(): void {
    this.patch({ viewportLocked: true });
    if (this.lockTimer) clearTimeout(this.lockTimer);
    this.lockTimer = setTimeout(() => {
      this.patch({ viewportLocked: false });
      this.lockTimer = null;
    }, REPLAY_SNAP_LOCK_MS);
  }

  scheduleSnap(request: ReplaySnapRequest, onFire: (req: ReplaySnapRequest) => void): void {
    this.patch({ pendingSnap: request, focusBarIndex: request.barIndex, status: 'SNAPPING_TO_SIGNAL' });
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      onFire(request);
      this.patch({ pendingSnap: null });
    }, REPLAY_UX_DEBOUNCE_MS);
  }

  clearFocusPulse(): void {
    this.patch({ focusBarIndex: null });
  }

  clearPendingSnap(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.patch({ pendingSnap: null, focusBarIndex: null, status: 'READY' });
  }

  reset(): void {
    if (this.lockTimer) clearTimeout(this.lockTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.stateSubject.next({ ...INITIAL });
  }

  private patch(partial: Partial<ReplayTransitionSnapshot>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
