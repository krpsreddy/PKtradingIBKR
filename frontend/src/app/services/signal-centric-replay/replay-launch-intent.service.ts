import { Injectable } from '@angular/core';
import { SignalReplayLaunchPlan } from '../signal-explorer/signal-explorer.models';

/** Cross-route replay launch intent — consumed by dashboard on init. */
@Injectable({ providedIn: 'root' })
export class ReplayLaunchIntentService {
  private pending: SignalReplayLaunchPlan | null = null;

  setPending(plan: SignalReplayLaunchPlan): void {
    this.pending = plan;
  }

  consume(): SignalReplayLaunchPlan | null {
    const plan = this.pending;
    this.pending = null;
    return plan;
  }

  hasPending(): boolean {
    return this.pending != null;
  }

  /** Read without clearing — dashboard consumes in ngAfterViewInit. */
  peek(): SignalReplayLaunchPlan | null {
    return this.pending;
  }
}
