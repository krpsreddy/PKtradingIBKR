import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  HydrationQueueState,
  HydrationStatus,
  SYMBOL_HISTORY_HYDRATION_STORAGE_KEY,
  SymbolHistoryHydrationState
} from './symbol-history-hydration.models';

@Injectable({ providedIn: 'root' })
export class SymbolHistoryHydrationStore {
  private readonly states = new Map<string, SymbolHistoryHydrationState>();
  private readonly revisionSubject = new BehaviorSubject<number>(0);
  readonly revision$ = this.revisionSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  get(symbol: string): SymbolHistoryHydrationState {
    return this.states.get(symbol.toUpperCase()) ?? this.empty(symbol);
  }

  all(): SymbolHistoryHydrationState[] {
    return [...this.states.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  upsert(symbol: string, patch: Partial<SymbolHistoryHydrationState>): SymbolHistoryHydrationState {
    const sym = symbol.toUpperCase();
    const next = { ...this.get(sym), ...patch, symbol: sym };
    this.states.set(sym, next);
    this.persist();
    this.revisionSubject.next(this.revisionSubject.value + 1);
    return next;
  }

  markEvaluatedSessions(symbol: string, dates: string[]): void {
    const sym = symbol.toUpperCase();
    const existing = this.get(sym);
    const merged = new Set([...existing.evaluatedSessionDates, ...dates]);
    this.upsert(sym, { evaluatedSessionDates: [...merged].sort() });
  }

  isFullyHydrated(symbol: string, targetDays = 60): boolean {
    const s = this.get(symbol);
    return s.hydrationStatus === 'READY'
      && s.loadedDays >= Math.min(targetDays, 39)
      && s.missingRanges.length === 0;
  }

  private empty(symbol: string): SymbolHistoryHydrationState {
    return {
      symbol: symbol.toUpperCase(),
      earliestLoadedTimestamp: null,
      latestLoadedTimestamp: null,
      loadedDays: 0,
      targetDays: 60,
      hydrationStatus: 'NOT_STARTED',
      lastHydratedAt: null,
      missingRanges: [],
      totalCandlesLoaded: 0,
      replayEvaluated: false,
      aiAnalyzed: false,
      evaluatedSessionDates: [],
      signalCount: 0,
      queueState: 'QUEUED'
    };
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(SYMBOL_HISTORY_HYDRATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { states?: Record<string, SymbolHistoryHydrationState> };
      for (const [sym, state] of Object.entries(parsed.states ?? {})) {
        if (state?.symbol) {
          this.states.set(sym.toUpperCase(), {
            ...this.empty(sym),
            ...state,
            hydrationStatus: state.hydrationStatus === 'LOADING' ? 'PARTIAL' : (state.hydrationStatus ?? 'NOT_STARTED'),
            queueState: state.queueState === 'LOADING' ? 'QUEUED' : (state.queueState ?? 'QUEUED'),
            currentPhase: null
          });
        }
      }
    } catch {
      // Corrupt storage — start fresh.
    }
  }

  private persist(): void {
    try {
      const states: Record<string, SymbolHistoryHydrationState> = {};
      for (const [sym, state] of this.states) {
        states[sym] = state;
      }
      localStorage.setItem(
        SYMBOL_HISTORY_HYDRATION_STORAGE_KEY,
        JSON.stringify({ version: 1, states, savedAt: Date.now() })
      );
    } catch {
      // Quota exceeded — ignore.
    }
  }
}

export function hydrationStatusLabel(status: HydrationStatus): string {
  switch (status) {
    case 'NOT_STARTED': return 'Not started';
    case 'PARTIAL': return 'Partial';
    case 'LOADING': return 'Loading';
    case 'READY': return 'Ready';
    case 'FAILED': return 'Failed';
  }
}

export function queueStateLabel(state: HydrationQueueState): string {
  switch (state) {
    case 'QUEUED': return 'Queued';
    case 'LOADING': return 'Loading';
    case 'RETRYING': return 'Retrying';
    case 'READY': return 'Ready';
    case 'FAILED': return 'Failed';
    case 'SKIPPED': return 'Skipped';
  }
}
