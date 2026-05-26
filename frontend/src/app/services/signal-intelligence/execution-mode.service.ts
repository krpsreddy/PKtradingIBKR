import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ExecutionFrameworkMode =
  | 'LEGACY_GOVERNANCE'
  | 'AUTONOMOUS_DISCOVERY'
  | 'HYBRID_COMPARISON';

const STORAGE_KEY = 'pk-execution-framework-mode';
const DEFAULT_MODE: ExecutionFrameworkMode = 'AUTONOMOUS_DISCOVERY';

/** Phase 160 — execution framework mode selector (advisory only). */
@Injectable({ providedIn: 'root' })
export class ExecutionModeService {
  private readonly modeSubject = new BehaviorSubject<ExecutionFrameworkMode>(this.load());

  readonly mode$ = this.modeSubject.asObservable();

  mode(): ExecutionFrameworkMode {
    return this.modeSubject.value;
  }

  setMode(mode: ExecutionFrameworkMode): void {
    this.modeSubject.next(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  isAutonomousPrimary(): boolean {
    return this.mode() === 'AUTONOMOUS_DISCOVERY' || this.mode() === 'HYBRID_COMPARISON';
  }

  isLegacyEnabled(): boolean {
    return this.mode() === 'LEGACY_GOVERNANCE' || this.mode() === 'HYBRID_COMPARISON';
  }

  isHybrid(): boolean {
    return this.mode() === 'HYBRID_COMPARISON';
  }

  private load(): ExecutionFrameworkMode {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'LEGACY_GOVERNANCE' || v === 'AUTONOMOUS_DISCOVERY' || v === 'HYBRID_COMPARISON') {
      return v;
    }
    return DEFAULT_MODE;
  }
}
