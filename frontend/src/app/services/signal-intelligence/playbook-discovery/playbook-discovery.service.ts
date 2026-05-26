import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SIGNAL_INTELLIGENCE_LOOKBACK_DAYS } from '../../../models/signal-intelligence.model';
import { isEvaluatedSignal } from '../signal-intelligence.math';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { PlaybookCandidateDiscoveryEngine } from './playbook-candidate-discovery.engine';
import { PlaybookEvolutionEngine, emergingCandidates, weakeningCandidates } from './playbook-evolution.engine';
import { PlaybookSimulationEngine } from './playbook-simulation.engine';
import { PlaybookRelationshipEngine } from './playbook-relationship.engine';
import { PlaybookCandidateStore } from './playbook-candidate.store';
import { PlaybookSynthesisService } from './playbook-synthesis.service';
import { PlaybookDiscoverySnapshot, PlaybookPromotionState } from './playbook-candidate.models';
import { AnalyticsStorageApiService } from '../persistent-analytics/analytics-storage-api.service';
import { environment } from '../../../../environments/environment';

/** Phase 139 orchestrator — slow-evolution playbook discovery (advisory only). */
@Injectable({ providedIn: 'root' })
export class PlaybookDiscoveryService {
  private readonly discoveryEngine = new PlaybookCandidateDiscoveryEngine();
  private readonly evolutionEngine = new PlaybookEvolutionEngine();
  private readonly simulationEngine = new PlaybookSimulationEngine();
  private readonly relationshipEngine = new PlaybookRelationshipEngine();

  private readonly snapshotSubject = new BehaviorSubject<PlaybookDiscoverySnapshot | null>(null);
  readonly snapshot$ = this.snapshotSubject.asObservable();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPersistKey = '';
  private lastPersistAt = 0;

  constructor(
    private store: SignalIntelligenceStore,
    private candidateStore: PlaybookCandidateStore,
    private synthesis: PlaybookSynthesisService,
    private analyticsApi: AnalyticsStorageApiService
  ) {
    this.store.revision$.subscribe(() => this.scheduleRefresh());
    this.candidateStore.revision$.subscribe(() => this.emitFromStore());
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const delay = environment.ngrokMode ? 30_000 : 8_000;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.refresh();
    }, delay);
  }

  snapshot(): PlaybookDiscoverySnapshot | null {
    return this.snapshotSubject.value;
  }

  refresh(): PlaybookDiscoverySnapshot {
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ fromTs });

    const { candidates: discovered, diagnostics, nearMisses } = this.discoveryEngine.discover(signals, lookbackDays);
    const { candidates, events } = this.evolutionEngine.evolve(discovered, this.candidateStore.all());
    this.candidateStore.saveDiscovery(candidates, events);

    const relationships = this.relationshipEngine.analyze(candidates);
    const simulations = candidates.slice(0, 12).map(c => this.simulationEngine.simulate(c, signals));
    const aiSummary = this.synthesis.synthesize(candidates, relationships);

    const snapshot: PlaybookDiscoverySnapshot = {
      generatedAt: Date.now(),
      lookbackDays,
      totalEvaluated: signals.filter(isEvaluatedSignal).length,
      candidates,
      emerging: emergingCandidates(candidates),
      weakening: weakeningCandidates(candidates),
      relationships,
      simulations,
      diagnostics,
      nearMisses,
      aiSummary,
      advisoryOnly: true
    };

    this.snapshotSubject.next(snapshot);
    this.persistPlaybooksIfNeeded(candidates);
    return snapshot;
  }

  private persistPlaybooksIfNeeded(candidates: PlaybookDiscoverySnapshot['candidates']): void {
    if (environment.ngrokMode || !candidates.length) return;
    const key = `${candidates.length}:${candidates[0]?.id ?? ''}`;
    const minInterval = environment.ngrokMode ? 120_000 : 30_000;
    const now = Date.now();
    if (key === this.lastPersistKey && now - this.lastPersistAt < minInterval) return;
    this.lastPersistKey = key;
    this.lastPersistAt = now;
    void this.analyticsApi.bulkUpsertPlaybooks(candidates);
  }

  promoteCandidate(id: string, state: PlaybookPromotionState): boolean {
    return this.candidateStore.promote(id, state) != null;
  }

  private emitFromStore(): void {
    const current = this.snapshotSubject.value;
    if (!current) return;
    this.snapshotSubject.next({
      ...current,
      candidates: this.candidateStore.all()
    });
  }
}
