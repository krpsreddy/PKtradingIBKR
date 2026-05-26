import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SignalReplayWorkflowService } from '../signal-centric-replay/signal-replay-workflow.service';
import { SignalCentricRow, SignalSmartShortcut } from '../signal-centric-replay/signal-centric-replay.models';
import { SignalExplorerEngine } from './signal-explorer.engine';
import { SignalExplorerFilterEngine } from './signal-explorer-filter.engine';
import { SignalNavigationEngine, SignalNavKind } from './signal-navigation.engine';
import { HistoricalSignalIndexEngine, DaySignalHeat } from './historical-signal-index.engine';
import { SignalClusteringEngine } from './signal-clustering.engine';
import { SignalQualityRankingEngine } from './signal-quality-ranking.engine';
import {
  DEFAULT_SIGNAL_EXPLORER_STATE,
  HistoricalSignalRecord,
  SignalExplorerFilters,
  SignalExplorerRow,
  SignalExplorerState,
  SignalReplayLaunchPlan,
  SignalTimeWindow
} from './signal-explorer.models';

export type SignalExplorerLaunchHandler = (plan: SignalReplayLaunchPlan) => Promise<void>;

/** Phase 153 + 155 — global signal explorer backed by signal-centric replay index. */
@Injectable({ providedIn: 'root' })
export class SignalExplorerSynthesisService {
  private readonly stateSubject = new BehaviorSubject<SignalExplorerState>({ ...DEFAULT_SIGNAL_EXPLORER_STATE });
  readonly state$ = this.stateSubject.asObservable();
  private launchHandler: SignalExplorerLaunchHandler | null = null;
  private cachedDatasetKey = '';
  private cachedRows: SignalExplorerRow[] = [];
  private cachedDiscovery: SignalExplorerState['discovery'] = null;
  private cachedHeatmap: DaySignalHeat[] = [];
  totalSignals = 0;
  journeySteps: string[] = [];

  constructor(
    private workflow: SignalReplayWorkflowService,
    private explorer: SignalExplorerEngine,
    private filterEngine: SignalExplorerFilterEngine,
    private navigation: SignalNavigationEngine,
    private indexEngine: HistoricalSignalIndexEngine,
    private clustering: SignalClusteringEngine,
    private ranking: SignalQualityRankingEngine
  ) {
    this.workflow.state$.subscribe(wf => {
      this.totalSignals = wf.totalSignals;
      this.journeySteps = wf.activeLaunch?.journeySteps ?? [];
    });
  }

  snapshot(): SignalExplorerState {
    return this.stateSubject.value;
  }

  registerLaunchHandler(handler: SignalExplorerLaunchHandler): void {
    this.launchHandler = handler;
    this.workflow.registerLaunchHandler(async ctx => {
      const plan: SignalReplayLaunchPlan = {
        signalId: ctx.signalId,
        symbol: ctx.symbol,
        sessionDate: ctx.sessionDate,
        replayIndex: ctx.replayIndex,
        openReviewMode: ctx.openReviewMode,
        centerViewport: ctx.centerViewport,
        pauseReplay: ctx.pauseReplay,
        replayMode: ctx.replayMode,
        barsBeforeSignal: ctx.barsBeforeSignal,
        candleIndex: ctx.candleIndex,
        journeySteps: ctx.journeySteps
      };
      if (this.launchHandler) await this.launchHandler(plan);
    });
  }

  async loadSymbol(symbol: string): Promise<void> {
    const sym = symbol.toUpperCase();
    this.cachedDatasetKey = '';
    this.cachedRows = [];
    this.cachedDiscovery = null;
    this.cachedHeatmap = [];
    this.patch({ symbol: sym, loading: true, error: null });
    await this.workflow.loadSymbol(sym);
    this.syncFromWorkflow();
  }

  setFilters(partial: Partial<SignalExplorerFilters>): void {
    const filters = { ...this.snapshot().filters, ...partial };
    this.patch({ filters });
    this.workflow.setFilters(this.toCentricFilters(filters));
    this.syncFromWorkflow();
  }

  applyShortcut(shortcut: SignalSmartShortcut): void {
    this.workflow.applyShortcut(shortcut);
    this.syncFromWorkflow();
  }

  selectSignal(signalId: string): void {
    const idx = this.navigation.indexOf(this.snapshot().filteredRows, signalId);
    this.patch({ selectedSignalId: signalId, selectedIndex: idx });
    this.workflow.selectSignal(signalId);
    const row = this.workflow.snapshot().filteredRows.find(r => r.signalId === signalId);
    this.journeySteps = row?.journeySteps?.length ? row.journeySteps : [];
  }

  async openSignal(signalId: string): Promise<boolean> {
    this.selectSignal(signalId);
    return this.workflow.openSignal(signalId, 'REVIEW_SIGNAL');
  }

  async trainFromSignal(signalId: string): Promise<boolean> {
    this.selectSignal(signalId);
    return this.workflow.trainFromSignal(signalId);
  }

  async launchSelected(): Promise<boolean> {
    return this.workflow.launchSelected('REVIEW_SIGNAL');
  }

  async navigate(kind: SignalNavKind): Promise<boolean> {
    if (kind === 'NEXT') return this.workflow.navigateNext();
    if (kind === 'PREV') return this.workflow.navigatePrev();
    const state = this.snapshot();
    const next = this.navigation.navigate(state.filteredRows, state.selectedSignalId, kind);
    if (!next) return false;
    return this.openSignal(next.signalId);
  }

  async bulkReviewNext(): Promise<boolean> {
    this.patch({ bulkReviewActive: true });
    return this.navigate('NEXT');
  }

  heatmap(): DaySignalHeat[] {
    return this.cachedHeatmap.length
      ? this.cachedHeatmap
      : this.indexEngine.heatmap(this.snapshot().rows, 60);
  }

  selectedRow(): SignalExplorerRow | null {
    const id = this.snapshot().selectedSignalId;
    if (!id) return null;
    return this.snapshot().filteredRows.find(r => r.signalId === id) ?? null;
  }

  private syncFromWorkflow(): void {
    const wf = this.workflow.snapshot();
    const datasetKey = `${wf.symbol}|${wf.generatedAt ?? ''}|${wf.rows.length}|${wf.totalSignals}`;
    let rows = this.cachedRows;
    let discovery = this.cachedDiscovery;

    if (datasetKey !== this.cachedDatasetKey) {
      this.cachedDatasetKey = datasetKey;
      const records = wf.rows.map(r => this.toHistoricalRecord(r));
      rows = this.explorer.toRows(records);
      discovery = this.ranking.buildDiscovery(rows);
      discovery.clusters = this.clustering.cluster(rows);
      this.cachedRows = rows;
      this.cachedDiscovery = discovery;
      this.cachedHeatmap = this.indexEngine.heatmap(rows, 60);
    }

    const filteredRecords = wf.filteredRows.map(r => this.toHistoricalRecord(r));
    const filteredRows = this.explorer.toRows(filteredRecords);

    this.patch({
      loading: wf.loading,
      error: wf.error,
      rows,
      filteredRows,
      discovery,
      selectedSignalId: wf.selectedSignalId,
      selectedIndex: filteredRows.findIndex(r => r.signalId === wf.selectedSignalId)
    });
  }

  private toHistoricalRecord(row: SignalCentricRow): HistoricalSignalRecord {
    return {
      signalId: row.signalId,
      symbol: row.symbol,
      sessionDate: row.sessionDate,
      timestamp: row.timestampIso,
      timestampMs: row.timestamp,
      decision: row.setup ?? String(row.decision),
      narrative: row.narrative,
      conviction: row.conviction,
      expectancy: row.resultR,
      actualR: row.resultR ?? row.mfe,
      fakeoutRisk: row.entryQuality === 'TRAP' ? 1 : null,
      entryQuality: row.entryQuality,
      replayReady: row.replayReady,
      replayIndex: row.replayIndex,
      snapshotId: row.replaySnapshotId
    };
  }

  private toCentricFilters(filters: SignalExplorerFilters): import('../signal-centric-replay/signal-centric-replay.models').SignalCentricFilters {
    const days = filters.timeWindow === 'TODAY' ? 1
      : filters.timeWindow === '5D' ? 5
      : filters.timeWindow === '20D' ? 20 : 60;
    return {
      decision: filters.decision,
      narrative: filters.narrative,
      quality: filters.quality,
      result: filters.result,
      conviction: filters.highConvictionOnly ? 'HIGH' : 'ALL',
      timeWindowDays: days,
      searchText: filters.searchText,
      sort: filters.sort === 'CONVICTION' ? 'CONVICTION'
        : filters.sort === 'ACTUAL_R' ? 'RESULT_R' : 'TIME_DESC'
    };
  }

  private patch(partial: Partial<SignalExplorerState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
