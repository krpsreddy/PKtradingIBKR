import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ReplayWorkstationSynthesisService } from '../replay-workstation/replay-workstation-synthesis.service';
import { ReplayHistory } from '../../models/replay.model';
import { HistoricalSignalQueryEngine } from './historical-signal-query.engine';
import { MultiSessionSignalIndexEngine } from './multi-session-signal-index.engine';
import { SignalExplorerStateService } from './signal-explorer-state.service';
import { SignalJumpContextEngine } from './signal-jump-context.engine';
import { SignalReplayIndexService } from './signal-replay-index.service';
import { SignalReplayNavigationEngine } from './signal-replay-navigation.engine';
import {
  DEFAULT_SIGNAL_CENTRIC_FILTERS,
  DEFAULT_SIGNAL_CENTRIC_STATE,
  SignalCentricExplorerState,
  SignalCentricFilters,
  SignalCentricRow,
  SignalReplayLaunchContext,
  SignalReplayMode,
  SignalSmartShortcut
} from './signal-centric-replay.models';

export type SignalCentricLaunchHandler = (ctx: SignalReplayLaunchContext) => Promise<void>;

/** Phase 155 — signal-centric replay orchestrator. */
@Injectable({ providedIn: 'root' })
export class SignalReplayWorkflowService {
  private readonly stateSubject = new BehaviorSubject<SignalCentricExplorerState>({ ...DEFAULT_SIGNAL_CENTRIC_STATE });
  readonly state$ = this.stateSubject.asObservable();
  private launchHandler: SignalCentricLaunchHandler | null = null;

  constructor(
    private indexApi: SignalReplayIndexService,
    private queryEngine: HistoricalSignalQueryEngine,
    private indexEngine: MultiSessionSignalIndexEngine,
    private filterEngine: SignalExplorerStateService,
    private navigation: SignalReplayNavigationEngine,
    private jumpContext: SignalJumpContextEngine,
    private workstation: ReplayWorkstationSynthesisService
  ) {}

  snapshot(): SignalCentricExplorerState {
    return this.stateSubject.value;
  }

  registerLaunchHandler(handler: SignalCentricLaunchHandler): void {
    this.launchHandler = handler;
  }

  async loadSymbol(symbol: string): Promise<void> {
    const sym = symbol.toUpperCase();
    this.patch({ symbol: sym, loading: true, error: null });
    const filters = this.snapshot().filters;
    const query = this.queryEngine.buildQuery(sym, filters);
    const page = await this.indexApi.fetchIndex(query);

    if (!page) {
      this.patch({
        loading: false,
        rows: [],
        filteredRows: [],
        totalSignals: 0,
        error: 'Replay signal index unavailable — check backend connection',
        generatedAt: null
      });
      return;
    }

    const deduped = this.indexEngine.dedupe(page.rows);
    const rows = this.indexEngine.toDisplayRows(deduped);
    const filteredRows = this.filterEngine.applyFilters(rows, filters);

    this.patch({
      loading: false,
      error: filteredRows.length ? null : 'No signals found — run history hydration or widen filters',
      rows,
      filteredRows,
      totalSignals: page.total,
      selectedSignalId: filteredRows[0]?.signalId ?? null,
      generatedAt: page.generatedAt
    });
  }

  setFilters(partial: Partial<SignalCentricFilters>): void {
    const filters = { ...this.snapshot().filters, ...partial };
    const filteredRows = this.filterEngine.applyFilters(this.snapshot().rows, filters);
    this.patch({
      filters,
      filteredRows,
      selectedSignalId: filteredRows[0]?.signalId ?? null,
      error: filteredRows.length ? null : 'No signals match current filters'
    });
  }

  applyShortcut(shortcut: SignalSmartShortcut): void {
    const filters = { ...this.snapshot().filters, ...this.filterEngine.shortcutFilter(shortcut) };
    const filteredRows = this.filterEngine.applyFilters(this.snapshot().rows, filters);
    this.patch({ filters, filteredRows, selectedSignalId: filteredRows[0]?.signalId ?? null });
  }

  selectSignal(signalId: string): void {
    this.patch({ selectedSignalId: signalId });
  }

  async openSignal(signalId: string, mode: SignalReplayMode = 'REVIEW_SIGNAL'): Promise<boolean> {
    const row = this.findRow(signalId);
    if (!row) return false;
    return this.launchRow(row, mode);
  }

  async launchSelected(mode: SignalReplayMode = 'REVIEW_SIGNAL'): Promise<boolean> {
    const id = this.snapshot().selectedSignalId;
    if (!id) return false;
    return this.openSignal(id, mode);
  }

  async navigateNext(): Promise<boolean> {
    const state = this.snapshot();
    const next = this.navigation.navigate(state.filteredRows, state.selectedSignalId, 'NEXT');
    if (!next) return false;
    return this.openSignal(next.signalId);
  }

  async navigatePrev(): Promise<boolean> {
    const state = this.snapshot();
    const prev = this.navigation.navigate(state.filteredRows, state.selectedSignalId, 'PREV');
    if (!prev) return false;
    return this.openSignal(prev.signalId);
  }

  async trainFromSignal(signalId: string): Promise<boolean> {
    return this.openSignal(signalId, 'TRAIN_FROM_SIGNAL');
  }

  private async launchRow(row: SignalCentricRow, mode: SignalReplayMode): Promise<boolean> {
    let replayIndex = row.replayIndex >= 0 ? row.replayIndex : row.candleIndex;
    if (replayIndex < 0) {
      const history = await this.workstation.loadSession(row.symbol, row.sessionDate);
      if (history?.sessionCandles?.length) {
        replayIndex = await this.jumpContext.resolveBarIndex(history, row.timestamp);
      }
    }
    if (replayIndex < 0) replayIndex = 0;

    const ctx = this.jumpContext.buildLaunchContext(
      { ...row, replayIndex, candleIndex: replayIndex },
      mode
    );
    this.patch({ selectedSignalId: row.signalId, activeLaunch: ctx });
    if (!this.launchHandler) return false;
    await this.launchHandler(ctx);
    return true;
  }

  private findRow(signalId: string): SignalCentricRow | null {
    return this.snapshot().filteredRows.find(r => r.signalId === signalId)
      ?? this.snapshot().rows.find(r => r.signalId === signalId)
      ?? null;
  }

  private patch(partial: Partial<SignalCentricExplorerState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}

export { DEFAULT_SIGNAL_CENTRIC_FILTERS };
