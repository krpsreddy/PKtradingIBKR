import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PaperExecutionRecord } from '../../models/paper-execution.model';
import { AssistedExitService } from '../assisted-exit-intelligence/assisted-exit.service';
import { ExecutionMonitorSnapshot } from '../../models/paper-execution.model';
import { ExitResearchSnapshot } from './shadow-exit.models';
import { buildExitResearchSnapshot } from './exit-comparison.engine';
import { runAllShadowModels, runShadowForAssisted } from './shadow-exit-runner.engine';
import { environment } from '../../../environments/environment';

const STORE_KEY = ((environment as { storagePrefix?: string }).storagePrefix ?? '') + 'shadow-exit-paths';

/** Phase 183 — shadow exit research orchestration (no real exits). */
@Injectable({ providedIn: 'root' })
export class ExitResearchAnalyticsService {
  private readonly snapshotSubject = new BehaviorSubject<ExitResearchSnapshot | null>(null);
  readonly snapshot$ = this.snapshotSubject.asObservable();

  constructor(private assisted: AssistedExitService) {}

  refresh(monitor: ExecutionMonitorSnapshot): ExitResearchSnapshot {
    const assistedSnap = this.assisted.refresh(monitor);
    const paths = [];
    for (const view of assistedSnap.positions) {
      paths.push(...runShadowForAssisted(view));
    }
    for (const h of monitor.history.filter(r => r.status === 'CLOSED' || r.status === 'OPEN')) {
      paths.push(...runAllShadowModels(h, null));
    }
    const snap = buildExitResearchSnapshot(paths);
    this.snapshotSubject.next(snap);
    this.persist(paths);
    return snap;
  }

  snapshot(): ExitResearchSnapshot | null {
    return this.snapshotSubject.value;
  }

  private persist(paths: ExitResearchSnapshot['paths']): void {
    try {
      const prev = this.loadPaths();
      const merged = [...prev, ...paths].slice(-500);
      localStorage.setItem(STORE_KEY, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
  }

  private loadPaths(): ExitResearchSnapshot['paths'] {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
