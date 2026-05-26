import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  DEFAULT_REPLAY_VIEWPORT_STATE,
  ReplayInteractionMode,
  ReplayViewportState
} from './replay-viewport.models';

@Injectable({ providedIn: 'root' })
export class ReplayViewportStateService {
  private readonly stateSubject = new BehaviorSubject<ReplayViewportState>({ ...DEFAULT_REPLAY_VIEWPORT_STATE });
  readonly state$ = this.stateSubject.asObservable();

  snapshot(): ReplayViewportState {
    return this.stateSubject.value;
  }

  patch(partial: Partial<ReplayViewportState>): ReplayViewportState {
    const next = { ...this.stateSubject.value, ...partial };
    this.stateSubject.next(next);
    return next;
  }

  setMode(mode: ReplayInteractionMode): ReplayViewportState {
    return this.patch({ mode });
  }

  reset(): void {
    this.stateSubject.next({ ...DEFAULT_REPLAY_VIEWPORT_STATE });
  }
}
