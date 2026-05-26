import { Injectable, Injector } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  ANALYTICS_STORAGE_VERSION,
  AnalyticsSyncState
} from './analytics-storage.models';
import { AnalyticsStorageApiService } from './analytics-storage-api.service';
import { PersistentEvaluatedSignalService } from './persistent-evaluated-signal.service';
import { HydrationStateService } from './hydration-state.service';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { SIGNAL_INTELLIGENCE_LOOKBACK_DAYS, SIGNAL_INTELLIGENCE_STORAGE_KEY, SignalSnapshot } from '../../../models/signal-intelligence.model';
import { PlaybookCandidateStore } from '../playbook-discovery/playbook-candidate.store';
import { SymbolEdgeAnalysisService } from '../../../ai/services/symbol-edge-analysis.service';
import { environment } from '../../../../environments/environment';

/** Incremental sync between frontend cache and persistent backend analytics. */
@Injectable({ providedIn: 'root' })
export class AnalyticsSyncService {
  private readonly stateSubject = new BehaviorSubject<AnalyticsSyncState>({
    bootstrapped: false,
    syncing: false,
    lastSyncAt: null,
    serverVersion: null,
    stale: false,
    error: null
  });

  readonly state$ = this.stateSubject.asObservable();

  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSync = false;
  private bootstrapping = false;

  constructor(
    private api: AnalyticsStorageApiService,
    private persistentSignals: PersistentEvaluatedSignalService,
    private hydrationState: HydrationStateService,
    private store: SignalIntelligenceStore,
    private playbookStore: PlaybookCandidateStore,
    private injector: Injector
  ) {
    void this.bootstrap();
    this.store.revision$.subscribe(() => this.scheduleSync());
  }

  state(): AnalyticsSyncState {
    return this.stateSubject.value;
  }

  /** Load backend analytics into store — server wins on conflicts; localStorage remains cache. */
  async bootstrap(): Promise<void> {
    if (this.bootstrapping) return;
    this.bootstrapping = true;
    this.patch({ syncing: true, error: null });

    try {
      const version = await this.api.fetchVersion();
      const stale = version?.stale ?? false;
      this.patch({ serverVersion: version?.currentVersion ?? ANALYTICS_STORAGE_VERSION, stale });

      const fromTs = Date.now() - SIGNAL_INTELLIGENCE_LOOKBACK_DAYS * 86_400_000;
      const serverSignals = await this.persistentSignals.loadAll({ fromTs, pageSize: 500 });

      if (serverSignals.length) {
        this.store.mergeFromServer(serverSignals);
      } else {
        await this.migrateLocalStorageToBackend();
        const evaluated = this.store.all().filter(s => s.evaluation?.status);
        if (evaluated.length) {
          await this.syncToBackend(evaluated);
        }
      }

      await this.hydrationState.bootstrapFromBackend();
      await this.loadPlaybooksFromBackend();

      this.patch({
        bootstrapped: true,
        syncing: false,
        lastSyncAt: Date.now(),
        error: null
      });
    } catch (err) {
      this.patch({
        bootstrapped: true,
        syncing: false,
        error: err instanceof Error ? err.message : 'Analytics bootstrap failed'
      });
    } finally {
      this.bootstrapping = false;
    }
  }

  async forceBulkSync(): Promise<void> {
    const evaluated = this.store.all().filter(s => s.evaluation?.status);
    if (evaluated.length) {
      await this.syncToBackend(evaluated);
    }
  }

  /** Push evaluated signals to PostgreSQL — materialize from replay cache when store is empty. */
  async ensureServerHasSnapshots(options: { symbol?: string } = {}): Promise<number> {
    const dbCount = await this.api.fetchStats();
    if ((dbCount?.evaluatedSnapshots ?? 0) > 0) {
      return dbCount!.evaluatedSnapshots;
    }

    const sym = options.symbol?.toUpperCase();
    const fromTs = Date.now() - SIGNAL_INTELLIGENCE_LOOKBACK_DAYS * 86_400_000;
    let candidates = this.store.all().filter(
      s => s.evaluation?.status && (!sym || s.symbol === sym)
    );

    if (candidates.length) {
      await this.syncToBackend(candidates);
      const after = await this.api.fetchStats();
      return after?.evaluatedSnapshots ?? candidates.length;
    }

    if (sym) {
      const recorded = await this.injector.get(SymbolEdgeAnalysisService).materializeFromReplayCache(sym);
      if (recorded > 0) {
        candidates = this.store.query({ symbol: sym, fromTs }).filter(s => s.evaluation?.status);
        await this.syncToBackend(candidates);
        return candidates.length;
      }
    } else {
      const sessions = (await this.api.fetchAllHydration()).filter(s => s.status === 'READY');
      for (const session of sessions) {
        const recorded = await this.injector.get(SymbolEdgeAnalysisService).materializeFromReplayCache(session.symbol);
        if (recorded <= 0) continue;
        const batch = this.store.query({ symbol: session.symbol, fromTs }).filter(s => s.evaluation?.status);
        await this.syncToBackend(batch);
      }
      const after = await this.api.fetchStats();
      if ((after?.evaluatedSnapshots ?? 0) > 0) {
        return after!.evaluatedSnapshots;
      }
    }

    return 0;
  }

  private scheduleSync(): void {
    if (!this.stateSubject.value.bootstrapped) return;
    if (environment.ngrokMode) return;
    this.pendingSync = true;
    if (this.syncTimer) return;
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      if (!this.pendingSync) return;
      this.pendingSync = false;
      void this.syncToBackend(this.store.all());
    }, 5000);
  }

  private async syncToBackend(signals: SignalSnapshot[]): Promise<void> {
    if (!signals.length) return;
    this.patch({ syncing: true });
    const chunkSize = 200;
    for (let i = 0; i < signals.length; i += chunkSize) {
      const chunk = signals.slice(i, i + chunkSize);
      await this.api.bulkUpsertSnapshots(chunk);
    }
    this.patch({ syncing: false, lastSyncAt: Date.now() });
  }

  private async migrateLocalStorageToBackend(): Promise<void> {
    const local = this.readLocalCache();
    if (!local.length) return;
    this.store.mergeFromServer(local);
    await this.api.bulkUpsertSnapshots(local);
  }

  private readLocalCache(): SignalSnapshot[] {
    try {
      const raw = localStorage.getItem(SIGNAL_INTELLIGENCE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { signals?: SignalSnapshot[] };
      return parsed.signals ?? [];
    } catch {
      return [];
    }
  }

  private async loadPlaybooksFromBackend(): Promise<void> {
    const candidates = await this.api.fetchPlaybookCandidates();
    if (!candidates.length) return;
    this.playbookStore.importFromServer(candidates);
  }

  private patch(partial: Partial<AnalyticsSyncState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
