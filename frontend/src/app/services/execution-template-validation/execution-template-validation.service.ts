import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ReplayHistory } from '../../models/replay.model';
import { SIGNAL_INTELLIGENCE_LOOKBACK_DAYS } from '../../models/signal-intelligence.model';
import { ReplaySnapshotStoreService } from '../signal-intelligence/replay-cache/replay-snapshot-store.service';
import { SignalIntelligenceStore } from '../signal-intelligence/signal-intelligence.store';
import { ExecutionTemplateValidationEngine } from './execution-template-validation.engine';
import {
  ExecutionTemplateValidationReport,
  ValidationProgress
} from './execution-template-validation.models';

/** Phase 176 — statistical validation: LEGACY_RR vs AUTONOMOUS_TEMPLATE on replay history. */
@Injectable({ providedIn: 'root' })
export class ExecutionTemplateValidationService {
  private readonly reportSubject = new BehaviorSubject<ExecutionTemplateValidationReport | null>(null);
  private readonly progressSubject = new BehaviorSubject<ValidationProgress | null>(null);
  private running = false;

  readonly report$ = this.reportSubject.asObservable();
  readonly progress$ = this.progressSubject.asObservable();

  constructor(
    private readonly engine: ExecutionTemplateValidationEngine,
    private readonly replayCache: ReplaySnapshotStoreService,
    private readonly signalStore: SignalIntelligenceStore
  ) {}

  snapshot(): ExecutionTemplateValidationReport | null {
    return this.reportSubject.value;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Run validation across cached replay sessions (60D lookback window). */
  async runValidation(lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS): Promise<ExecutionTemplateValidationReport> {
    if (this.running) {
      return this.reportSubject.value!;
    }
    this.running = true;
    this.progressSubject.next({ phase: 'Loading replay cache…', done: 0, total: 1 });

    try {
      const sessionsBySymbol = this.collectSessions(lookbackDays);
      const report = await new Promise<ExecutionTemplateValidationReport>(resolve => {
        setTimeout(() => {
          const r = this.engine.run(sessionsBySymbol, p => this.progressSubject.next(p));
          resolve(r);
        }, 0);
      });
      this.reportSubject.next(report);
      console.info('[ExecutionTemplateValidation]', report);
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
