import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ACTIVE_PAPER_MODES,
  PaperExecutionMode,
  PaperExecutionStatusDto
} from '../models/paper-execution.model';
import { PaperExecutionApiService } from './paper-execution-api.service';

const MODE_KEY = 'execution-mode';

/** Phase 181 — global AUTO EXECUTION switch (OFF / PAPER RESEARCH). */
@Injectable({ providedIn: 'root' })
export class ExecutionModeService {
  private readonly storageKey =
    (environment as { storagePrefix?: string }).storagePrefix + MODE_KEY;
  private readonly modeSubject = new BehaviorSubject<PaperExecutionMode>('OFF');
  private readonly statusSubject = new BehaviorSubject<PaperExecutionStatusDto | null>(null);

  readonly mode$ = this.modeSubject.asObservable();
  readonly status$ = this.statusSubject.asObservable();

  constructor(private api: PaperExecutionApiService) {}

  get mode(): PaperExecutionMode {
    return this.modeSubject.value;
  }

  get isPaperResearch(): boolean {
    return this.mode === 'PAPER_RESEARCH';
  }

  get researchInfrastructureEnabled(): boolean {
    return (
      (environment as { paperExecutionResearch?: boolean }).paperExecutionResearch === true
      || this.statusSubject.value?.researchInfrastructureEnabled === true
    );
  }

  refreshStatus(): Observable<PaperExecutionStatusDto | null> {
    return this.api.status().pipe(
      tap(s => {
        this.statusSubject.next(s);
        if (ACTIVE_PAPER_MODES.includes(s.mode)) {
          this.modeSubject.next(s.mode);
          this.persistLocal(s.mode);
        }
      }),
      catchError(() => {
        this.statusSubject.next(null);
        return of(null);
      })
    );
  }

  setMode(mode: PaperExecutionMode): Observable<PaperExecutionStatusDto | null> {
    if (!ACTIVE_PAPER_MODES.includes(mode)) {
      return of(null);
    }
    this.modeSubject.next(mode);
    this.persistLocal(mode);
    return this.api.setMode(mode).pipe(
      tap(s => this.statusSubject.next(s)),
      catchError(() => of(null))
    );
  }

  bootstrap(): void {
    const local = this.loadLocal();
    if (local && ACTIVE_PAPER_MODES.includes(local)) {
      this.modeSubject.next(local);
    }
    this.refreshStatus().subscribe(s => {
      if (s?.mode && ACTIVE_PAPER_MODES.includes(s.mode)) {
        this.modeSubject.next(s.mode);
      } else if (local) {
        this.setMode(local).subscribe();
      }
    });
  }

  private persistLocal(mode: PaperExecutionMode): void {
    try {
      localStorage.setItem(this.storageKey, mode);
    } catch {
      /* ignore */
    }
  }

  private loadLocal(): PaperExecutionMode | null {
    try {
      const v = localStorage.getItem(this.storageKey);
      return v as PaperExecutionMode | null;
    } catch {
      return null;
    }
  }
}
