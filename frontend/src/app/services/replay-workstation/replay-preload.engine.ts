import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { of } from 'rxjs';
import { ReplayService } from '../replay.service';
import { ReplayCacheApiService } from '../signal-intelligence/replay-cache/replay-cache-api.service';
import { ReplayHistory } from '../../models/replay.model';
import { ReplayPerformanceDiagnosticsService } from '../replay-performance/replay-performance-diagnostics.service';

@Injectable({ providedIn: 'root' })
export class ReplayPreloadEngine {
  constructor(
    private cacheApi: ReplayCacheApiService,
    private replayService: ReplayService,
    private diagnostics: ReplayPerformanceDiagnosticsService
  ) {}

  async loadSession(symbol: string, sessionDate: string): Promise<{ history: ReplayHistory | null; cacheHit: boolean }> {
    this.diagnostics.beginPhase('A_CANDLES');
    const t0 = performance.now();
    const cached = await this.cacheApi.fetchSessionSnapshot(symbol, sessionDate);
    if (cached?.sessionCandles?.length) {
      this.diagnostics.recordRequest({
        endpoint: `replay-cache/snapshot/${symbol}/${sessionDate}`,
        method: 'GET',
        symbol,
        durationMs: Math.round(performance.now() - t0),
        payloadBytes: 0,
        cacheHit: true,
        phase: 'A_CANDLES'
      });
      return { history: cached, cacheHit: true };
    }
    try {
      const history = await firstValueFrom(
        this.replayService.loadHistory(symbol, sessionDate).pipe(
          timeout(30_000),
          catchError(() => of(null))
        )
      );
      this.diagnostics.recordRequest({
        endpoint: `replay/history/${symbol}`,
        method: 'GET',
        symbol,
        durationMs: Math.round(performance.now() - t0),
        payloadBytes: 0,
        cacheHit: false,
        phase: 'A_CANDLES'
      });
      return { history, cacheHit: false };
    } catch {
      return { history: null, cacheHit: false };
    }
  }

  async loadCatalog(symbol: string, days = 60) {
    return this.cacheApi.fetchSnapshotSummary(symbol, days);
  }
}
