import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AnalyticsStorageApiService } from './analytics-storage-api.service';
import { PersistedHydrationSession } from './analytics-storage.models';
import { SymbolHistoryHydrationStore } from '../../../ai/services/hydration/symbol-history-hydration.store';
import { SymbolHistoryHydrationState } from '../../../ai/services/hydration/symbol-history-hydration.models';

/** Frontend hydration state backed by persistent backend (localStorage = cache). */
@Injectable({ providedIn: 'root' })
export class HydrationStateService {
  private readonly readySubject = new BehaviorSubject<boolean>(false);
  readonly ready$ = this.readySubject.asObservable();

  constructor(
    private api: AnalyticsStorageApiService,
    private localHydration: SymbolHistoryHydrationStore
  ) {}

  async bootstrapFromBackend(): Promise<void> {
    const sessions = await this.api.fetchAllHydration();
    if (!sessions.length) {
      this.readySubject.next(true);
      return;
    }
    for (const s of sessions) {
      this.applyToLocalCache(s);
    }
    this.readySubject.next(true);
  }

  async persistSymbol(state: SymbolHistoryHydrationState): Promise<void> {
    const session: PersistedHydrationSession = {
      symbol: state.symbol,
      lookbackDays: state.targetDays,
      candlesLoaded: state.totalCandlesLoaded,
      signalsEvaluated: state.signalCount,
      status: mapHydrationStatus(state.hydrationStatus),
      evaluatedSessionDates: state.evaluatedSessionDates,
      analyticsVersion: 1,
      startedAt: state.lastHydratedAt ? new Date(state.lastHydratedAt).toISOString() : null,
      completedAt: state.hydrationStatus === 'READY' && state.lastHydratedAt
        ? new Date(state.lastHydratedAt).toISOString()
        : null,
      stale: false
    };
    await this.api.upsertHydration(session);
  }

  private applyToLocalCache(s: PersistedHydrationSession): void {
    this.localHydration.upsert(s.symbol, {
      symbol: s.symbol,
      hydrationStatus: reverseStatus(s.status),
      evaluatedSessionDates: s.evaluatedSessionDates ?? [],
      totalCandlesLoaded: s.candlesLoaded ?? 0,
      signalCount: s.signalsEvaluated ?? 0,
      targetDays: s.lookbackDays ?? 60,
      replayEvaluated: s.status === 'READY',
      lastHydratedAt: s.completedAt ? Date.parse(s.completedAt) : null
    });
  }
}

function mapHydrationStatus(status: SymbolHistoryHydrationState['hydrationStatus']): string {
  if (status === 'READY') return 'READY';
  if (status === 'FAILED') return 'FAILED';
  if (status === 'LOADING') return 'PROCESSING';
  return 'PARTIAL';
}

function reverseStatus(status: string): SymbolHistoryHydrationState['hydrationStatus'] {
  switch (status) {
    case 'READY': return 'READY';
    case 'FAILED': return 'FAILED';
    case 'PROCESSING': return 'LOADING';
    default: return 'PARTIAL';
  }
}
