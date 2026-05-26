import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  ExecutionState,
  ExecutionStateContext,
  ExecutionStateSnapshot
} from '../models/execution-state.model';

export type StateTransitionHook = (from: ExecutionState, to: ExecutionState) => void;

@Injectable({ providedIn: 'root' })
export class ExecutionStateService {
  private readonly snapshotSubject = new BehaviorSubject<ExecutionStateSnapshot>({
    state: 'WATCHING',
    previous: null,
    changedAt: Date.now()
  });

  /** Disabled by default — wire audio/haptics here when enabled. */
  soundHooksEnabled = false;
  private transitionHooks: StateTransitionHook[] = [];

  readonly executionState$ = this.snapshotSubject.asObservable();

  registerTransitionHook(hook: StateTransitionHook): () => void {
    this.transitionHooks.push(hook);
    return () => {
      this.transitionHooks = this.transitionHooks.filter(h => h !== hook);
    };
  }

  snapshot(): ExecutionStateSnapshot {
    return this.snapshotSubject.value;
  }

  state(): ExecutionState {
    return this.snapshotSubject.value.state;
  }

  evaluate(ctx: ExecutionStateContext): ExecutionStateSnapshot {
    const next = this.resolve(ctx);
    const current = this.snapshotSubject.value;
    if (current.state === next) return current;
    const snap: ExecutionStateSnapshot = {
      state: next,
      previous: current.state,
      changedAt: Date.now()
    };
    this.snapshotSubject.next(snap);
    if (this.soundHooksEnabled) {
      for (const hook of this.transitionHooks) hook(current.state, next);
    }
    return snap;
  }

  private resolve(ctx: ExecutionStateContext): ExecutionState {
    if (ctx.replayMode) return 'REVIEWING';

    if (ctx.adaptiveExit?.includes('EXIT') || ctx.deterioration === 'FAILING'
        || (ctx.failurePct != null && ctx.failurePct >= 45)) {
      return 'EXITING';
    }

    if (ctx.tradeActive && ctx.estimatedRr != null && ctx.estimatedRr >= 1.5
        && ctx.continuationCurrent != null && ctx.continuationStart != null
        && ctx.continuationCurrent >= ctx.continuationStart) {
      return 'SCALING';
    }

    if (ctx.tradeActive || ctx.setupMaturity === 'CONFIRMED' || ctx.setupMaturity === 'TRIGGERED') {
      return 'MANAGING';
    }

    if (ctx.triggerActive || (ctx.hasValidSetup && (ctx.freshness === 'FRESH' || ctx.freshness === 'ACTIVE')
        && ctx.setupMaturity !== 'WEAKENING')) {
      return 'TRIGGERED';
    }

    if (ctx.nearTrigger || (ctx.relativeVolume != null && ctx.relativeVolume >= 2
        && ctx.regimeAligned !== false && !ctx.noEdge)) {
      return 'READY';
    }

    return 'WATCHING';
  }
}
