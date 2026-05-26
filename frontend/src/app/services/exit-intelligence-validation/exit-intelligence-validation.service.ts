import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ReplayHistory } from '../../models/replay.model';
import { SIGNAL_INTELLIGENCE_LOOKBACK_DAYS } from '../../models/signal-intelligence.model';
import { ReplaySnapshotStoreService } from '../signal-intelligence/replay-cache/replay-snapshot-store.service';
import { SignalIntelligenceStore } from '../signal-intelligence/signal-intelligence.store';
import { ExitIntelligenceValidationEngine } from './exit-intelligence-validation.engine';
import {
  ExitIntelligenceValidationReport,
  ExitValidationProgress
} from './exit-intelligence-validation.models';

/** Phase 180 — exit intelligence validation (research only). */
@Injectable({ providedIn: 'root' })
export class ExitIntelligenceValidationService {
  private readonly reportSubject = new BehaviorSubject<ExitIntelligenceValidationReport | null>(null);
  private readonly progressSubject = new BehaviorSubject<ExitValidationProgress | null>(null);
  private running = false;

  readonly report$ = this.reportSubject.asObservable();
  readonly progress$ = this.progressSubject.asObservable();

  constructor(
    private readonly engine: ExitIntelligenceValidationEngine,
    private readonly replayCache: ReplaySnapshotStoreService,
    private readonly signalStore: SignalIntelligenceStore
  ) {}

  snapshot(): ExitIntelligenceValidationReport | null {
    return this.reportSubject.value;
  }

  isRunning(): boolean {
    return this.running;
  }

  async runValidation(lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS): Promise<ExitIntelligenceValidationReport> {
    if (this.running && this.reportSubject.value) {
      return this.reportSubject.value;
    }
    this.running = true;
    this.progressSubject.next({ phase: 'Loading replay cache…', done: 0, total: 1 });

    try {
      const sessions = this.collectSessions(lookbackDays);
      const report = await new Promise<ExitIntelligenceValidationReport>(resolve => {
        setTimeout(() => {
          resolve(this.engine.run(sessions, p => this.progressSubject.next(p)));
        }, 0);
      });
      this.reportSubject.next(report);
      console.info('[ExitIntelligenceValidation]', report);
      return report;
    } finally {
      this.running = false;
      this.progressSubject.next(null);
    }
  }

  private collectSessions(lookbackDays: number): Map<string, ReplayHistory[]> {
    const cutoff = Date.now() - lookbackDays * 86_400_000;
    const map = new Map<string, ReplayHistory[]>();
    const symbols = new Set<string>([
      ...this.replayCache.allSymbols(),
      ...this.signalStore.all().map(s => s.symbol)
    ]);
    for (const sym of symbols) {
      const sessions = this.replayCache.getSymbolSessions(sym).filter(s => {
        const t = new Date(s.replayDate).getTime();
        return Number.isFinite(t) && t >= cutoff - 86_400_000
          && (s.timeline?.length ?? 0) > 0
          && (s.sessionCandles?.length ?? 0) > 0;
      });
      if (sessions.length) map.set(sym, sessions);
    }
    return map;
  }
}
