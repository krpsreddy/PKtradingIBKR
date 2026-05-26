import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { of } from 'rxjs';
import { ReplayService } from '../replay.service';
import { ReplayCacheApiService } from '../signal-intelligence/replay-cache/replay-cache-api.service';
import { ReplayHistory } from '../../models/replay.model';

@Injectable({ providedIn: 'root' })
export class ReplayPreloadEngine {
  constructor(
    private cacheApi: ReplayCacheApiService,
    private replayService: ReplayService
  ) {}

  async loadSession(symbol: string, sessionDate: string): Promise<{ history: ReplayHistory | null; cacheHit: boolean }> {
    const cached = await this.cacheApi.fetchSessionSnapshot(symbol, sessionDate);
    if (cached?.sessionCandles?.length) {
      return { history: cached, cacheHit: true };
    }
    try {
      const history = await firstValueFrom(
        this.replayService.loadHistory(symbol, sessionDate).pipe(
          timeout(30_000),
          catchError(() => of(null))
        )
      );
      return { history, cacheHit: false };
    } catch {
      return { history: null, cacheHit: false };
    }
  }

  async loadCatalog(symbol: string, days = 60) {
    return this.cacheApi.fetchSnapshotSummary(symbol, days);
  }
}
