import { Injectable } from '@angular/core';
import { ReplayHistory } from '../../models/replay.model';
import { ReplayPreloadEngine } from '../replay-workstation/replay-preload.engine';
import { ReplayPerformanceDiagnosticsService } from './replay-performance-diagnostics.service';

export interface PhasedReplayLoadResult {
  history: ReplayHistory | null;
  cacheHit: boolean;
}

/**
 * Phase 193 — replay load phases (A candles first; overlays deferred by caller).
 */
@Injectable({ providedIn: 'root' })
export class ReplayPhasedLoadService {
  constructor(
    private preload: ReplayPreloadEngine,
    private diagnostics: ReplayPerformanceDiagnosticsService
  ) {}

  async loadSessionCandles(symbol: string, sessionDate: string): Promise<PhasedReplayLoadResult> {
    this.diagnostics.beginPhase('A_CANDLES');
    const result = await this.preload.loadSession(symbol, sessionDate);
    return result;
  }
}
