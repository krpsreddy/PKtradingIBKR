import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ExecutionPlanMode } from '../autonomous-execution-templates/autonomous-template.models';

const STORAGE_KEY = 'trading.execution.planMode';

/** Phase 175 — feature flag: legacy RR vs autonomous templates vs side-by-side compare. */
@Injectable({ providedIn: 'root' })
export class ExecutionPlanModeService {
  private readonly modeSubject = new BehaviorSubject<ExecutionPlanMode>(this.load());

  readonly mode$ = this.modeSubject.asObservable();

  mode(): ExecutionPlanMode {
    return this.modeSubject.value;
  }

  setMode(mode: ExecutionPlanMode): void {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch { /* ignore */ }
    this.modeSubject.next(mode);
  }

  useAutonomous(): boolean {
    return this.mode() === 'AUTONOMOUS_TEMPLATE';
  }

  compareEnabled(): boolean {
    return this.mode() === 'COMPARE';
  }

  private load(): ExecutionPlanMode {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'AUTONOMOUS_TEMPLATE' || raw === 'COMPARE' || raw === 'LEGACY_RR') {
        return raw;
      }
    } catch { /* ignore */ }
    return 'LEGACY_RR';
  }
}
