import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

/** Phase 192 — Angular platform mode (research default; live runtime in Flutter). */
export type PlatformMode = 'RESEARCH' | 'LIVE_DEBUG';

const STORAGE_KEY = `${environment.storagePrefix}platform-mode`;

@Injectable({ providedIn: 'root' })
export class ResearchModeService {
  private readonly modeSubject = new BehaviorSubject<PlatformMode>(this.loadInitial());
  readonly mode$ = this.modeSubject.asObservable();

  mode(): PlatformMode {
    return this.modeSubject.value;
  }

  isResearch(): boolean {
    return this.modeSubject.value === 'RESEARCH';
  }

  isLiveDebug(): boolean {
    return this.modeSubject.value === 'LIVE_DEBUG';
  }

  /** Live scanner, feeds, enrich-all, IBKR subscribe — Flutter owns these when false. */
  allowsLiveRuntime(): boolean {
    return this.isLiveDebug();
  }

  setMode(mode: PlatformMode): void {
    if (mode === 'LIVE_DEBUG' && !this.liveDebugAllowed()) {
      return;
    }
    this.modeSubject.next(mode);
    this.persist(mode);
  }

  toggleLiveDebug(): void {
    this.setMode(this.isResearch() ? 'LIVE_DEBUG' : 'RESEARCH');
  }

  liveDebugAllowed(): boolean {
    return (environment as { liveDebugAllowed?: boolean }).liveDebugAllowed !== false;
  }

  label(): string {
    return this.isResearch() ? 'Research' : 'Live debug';
  }

  private loadInitial(): PlatformMode {
    const defaultMode: PlatformMode =
      (environment as { researchModeDefault?: boolean }).researchModeDefault === false
        ? 'LIVE_DEBUG'
        : 'RESEARCH';
    try {
      const raw = localStorage.getItem(STORAGE_KEY) as PlatformMode | null;
      if (raw === 'LIVE_DEBUG' && this.liveDebugAllowed()) {
        return 'LIVE_DEBUG';
      }
      if (raw === 'RESEARCH') {
        return 'RESEARCH';
      }
    } catch {
      /* ignore */
    }
    return defaultMode;
  }

  private persist(mode: PlatformMode): void {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }
}
