import { Injectable } from '@angular/core';
import { BulkReplayHistory } from '../../../models/replay.model';
import { ReplayCacheApiService } from './replay-cache-api.service';
import { ReplaySnapshotStoreService } from './replay-snapshot-store.service';
import { HydrationCachePhase, IncrementalReplayResponse } from './replay-cache.models';

export interface IncrementalHydrationOptions {
  lookbackDays?: number;
  evaluatedSessionDates?: string[];
  force?: boolean;
  onPhase?: (phase: HydrationCachePhase, detail?: string) => void;
}

export interface IncrementalHydrationResult {
  bulk: BulkReplayHistory;
  fromCache: number;
  replayed: number;
  cacheFirst: boolean;
}

/** Phase 149 — cache-first hydration: load snapshots, replay only stale/missing. */
@Injectable({ providedIn: 'root' })
export class IncrementalHydrationService {

  constructor(
    private api: ReplayCacheApiService,
    private snapshotStore: ReplaySnapshotStoreService
  ) {}

  async hydrateSymbol(
    symbol: string,
    lookbackDays = 60,
    options: IncrementalHydrationOptions = {}
  ): Promise<IncrementalHydrationResult> {
    const sym = symbol.toUpperCase();
    const force = options.force ?? false;

    options.onPhase?.('snapshots', 'Loading replay snapshots…');
    const summary = await this.api.fetchSnapshotSummary(sym, lookbackDays);

    options.onPhase?.('validate', 'Validating cached analytics…');
    const staleInfo = await this.api.fetchStaleSessions(sym, lookbackDays);

    const needsReplay = force
      || !summary
      || summary.missingSessions > 0
      || summary.staleSessions > 0
      || summary.readySessions === 0;

    if (!needsReplay && summary && summary.readySessions > 0) {
      const cached = this.snapshotStore.getSymbolSessions(sym);
      if (cached.length >= summary.readySessions) {
        const bulk: BulkReplayHistory = {
          symbol: sym,
          lookbackDays,
          sessionsProcessed: cached.length,
          sessionsWithSignals: cached.filter(s => s.simulatedSignals > 0).length,
          totalSignals: cached.reduce((n, s) => n + s.simulatedSignals, 0),
          candlesStored: 0,
          historyStatus: 'READY',
          historyMessage: `${cached.length} sessions loaded from replay cache`,
          sessions: cached
        };
        return { bulk, fromCache: cached.length, replayed: 0, cacheFirst: true };
      }
    }

    options.onPhase?.('stale-replay', needsReplay
      ? `Replaying ${(staleInfo?.staleDates.length ?? 0) + (staleInfo?.missingDates.length ?? 0)} stale sessions…`
      : 'Loading replay snapshots…');

    const result = await this.api.incrementalReplay(sym, lookbackDays, force);
    if (!result) {
      return {
        bulk: this.emptyBulk(sym, lookbackDays, 'Incremental replay failed'),
        fromCache: 0,
        replayed: 0,
        cacheFirst: false
      };
    }

    this.snapshotStore.merge(sym, result.sessions ?? []);

    const bulk = this.api.toBulkHistory(result);
    return {
      bulk,
      fromCache: result.sessionsFromCache ?? 0,
      replayed: result.sessionsReplayed ?? 0,
      cacheFirst: (result.sessionsFromCache ?? 0) > 0 && (result.sessionsReplayed ?? 0) === 0
    };
  }

  private emptyBulk(symbol: string, days: number, message: string): BulkReplayHistory {
    return {
      symbol,
      lookbackDays: days,
      sessionsProcessed: 0,
      sessionsWithSignals: 0,
      totalSignals: 0,
      historyStatus: 'ERROR',
      historyMessage: message,
      sessions: []
    };
  }
}
