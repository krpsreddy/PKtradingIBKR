import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Candle } from '../../models/candle.model';
import { TradingSignal } from '../../models/signal.model';
import { ReplayHistory, ReplaySignalEvent } from '../../models/replay.model';
import { ReplayPreloadEngine } from './replay-preload.engine';
import { ReplaySessionNavigationEngine } from './replay-session-navigation.engine';
import { ReplayTimelineContextEngine } from './replay-timeline-context.engine';
import {
  ReplaySessionPersistenceService
} from './replay-session-persistence.service';
import { ReplaySessionSelectorService } from './replay-session-selector.service';
import {
  catalogFromSummary,
  DEFAULT_WORKSTATION_STATE,
  ReplayDisplayContext,
  ReplayDisplayMode,
  ReplaySessionCatalogEntry,
  ReplaySignalJumpKind,
  ReplaySignalVisibility,
  ReplayStartMode,
  ReplayWorkstationMode,
  ReplayWorkstationState,
  CrossSessionJumpTarget
} from './replay-workstation.models';
import { ReplayContextMode } from '../replay-decision-visualization/replay-decision-visualization.models';
import { ReplayMultiDayContextEngine } from '../replay-decision-visualization/replay-multi-day-context.engine';
import { ResearchModeService } from '../research-mode.service';
import { ReplayProfessionalReviewService } from '../replay-decision-visualization/replay-professional-review.service';

const EXIT_TYPES = new Set(['EXIT', 'OPEN_FAIL', 'RECOVERY_FAIL']);

@Injectable({ providedIn: 'root' })
export class MultiDayReplayStoreService {
  private readonly stateSubject = new BehaviorSubject<ReplayWorkstationState>({ ...DEFAULT_WORKSTATION_STATE });
  readonly state$ = this.stateSubject.asObservable();

  snapshot(): ReplayWorkstationState {
    return this.stateSubject.value;
  }

  patch(partial: Partial<ReplayWorkstationState>): ReplayWorkstationState {
    const next = { ...this.stateSubject.value, ...partial };
    this.stateSubject.next(next);
    return next;
  }

  reset(): void {
    this.stateSubject.next({ ...DEFAULT_WORKSTATION_STATE });
  }
}

@Injectable({ providedIn: 'root' })
export class ReplayWorkstationSynthesisService {
  constructor(
    private store: MultiDayReplayStoreService,
    private preload: ReplayPreloadEngine,
    private navigation: ReplaySessionNavigationEngine,
    private timeline: ReplayTimelineContextEngine,
    private persistence: ReplaySessionPersistenceService,
    private selector: ReplaySessionSelectorService,
    private multiDay: ReplayMultiDayContextEngine,
    private review: ReplayProfessionalReviewService,
    private researchMode: ResearchModeService
  ) {}

  get state$() {
    return this.store.state$;
  }

  snapshot(): ReplayWorkstationState {
    return this.store.snapshot();
  }

  async openWorkstation(symbol: string, preferredDate?: string): Promise<ReplayHistory | null> {
    const sym = symbol.toUpperCase();
    this.store.patch({ symbol: sym, loading: true, error: null });

    const persisted = this.persistence.load(sym);
    const [catalogPage, summaries] = await Promise.all([
      this.preload.loadCatalog(sym, 60),
      this.review.fetchSessionSummaries(sym, 60)
    ]);
    const fallback = (catalogPage?.sessions ?? []).map(catalogFromSummary);
    const sessions = summaries?.length
      ? this.review.enrichCatalog(summaries, fallback)
      : fallback;

    const sessionDate = preferredDate
      ?? this.selector.pickDefaultSession(sessions, persisted?.selectedSessionDate)
      ?? sessions.find(s => s.replayReady)?.sessionDate
      ?? (sessions.length ? sessions[sessions.length - 1].sessionDate : null);

    if (!sessionDate) {
      this.store.patch({
        loading: false,
        sessions,
        error: 'No replay sessions in catalog — pick a date or run history hydration'
      });
      return null;
    }

    return this.loadSession(sym, sessionDate, {
      startMode: persisted?.startMode,
      displayMode: persisted?.displayMode,
      workstationMode: persisted?.workstationMode,
      contextMode: persisted?.contextMode ?? (this.researchMode.isResearch() ? 'INTRADAY_ONLY' : undefined),
      cursorIndex: persisted?.cursorIndex,
      visibility: persisted?.visibility,
      sessions,
      loadPriorContext: !this.researchMode.isResearch()
    });
  }

  async loadSession(
    symbol: string,
    sessionDate: string,
    opts?: {
      startMode?: ReplayStartMode;
      displayMode?: ReplayDisplayMode;
      workstationMode?: ReplayWorkstationMode;
      contextMode?: ReplayContextMode;
      cursorIndex?: number;
      visibility?: ReplaySignalVisibility;
      sessions?: ReplaySessionCatalogEntry[];
      /** Phase 193 — skip loading prior-session candles (expensive waterfall). */
      loadPriorContext?: boolean;
    }
  ): Promise<ReplayHistory | null> {
    const sym = symbol.toUpperCase();
    this.store.patch({ symbol: sym, loading: true, error: null, selectedSessionDate: sessionDate });

    const { history, cacheHit } = await this.preload.loadSession(sym, sessionDate);
    if (!history?.sessionCandles?.length) {
      this.store.patch({
        loading: false,
        error: `No replay data for ${sessionDate}`,
        history: null
      });
      return null;
    }

    const startMode = opts?.startMode ?? this.store.snapshot().startMode;
    const displayMode = opts?.displayMode ?? this.store.snapshot().displayMode;
    const workstationMode = opts?.workstationMode ?? this.store.snapshot().workstationMode;
    const contextMode = opts?.contextMode
      ?? this.store.snapshot().contextMode
      ?? (this.researchMode.isResearch() ? 'INTRADAY_ONLY' : 'PREVIOUS_DAY');
    const sessions = opts?.sessions ?? this.store.snapshot().sessions;

    const loadPrior = opts?.loadPriorContext ?? !this.researchMode.isResearch();
    const priorDates = loadPrior
      ? this.multiDay.priorSessionDates(sessionDate, sessions, contextMode)
      : [];
    const priorSessions: ReplayHistory[] = [];
    for (const d of priorDates) {
      const prior = await this.preload.loadSession(sym, d);
      if (prior.history?.sessionCandles.length) priorSessions.push(prior.history);
    }
    const priorSession = priorSessions.length ? priorSessions[priorSessions.length - 1] : null;
    const merged = this.multiDay.mergeContextCandles(priorSessions, history);

    const startIndex = displayMode === 'REVIEW'
      ? history.sessionCandles.length - 1
      : opts?.cursorIndex != null && opts.cursorIndex >= 0
        ? Math.min(opts.cursorIndex, history.sessionCandles.length - 1)
        : this.timeline.resolveStartIndex(history, startMode);

    const state = this.store.patch({
      loading: false,
      error: null,
      history,
      priorSession,
      priorSessions,
      contextMode,
      sessionStartIndex: merged.sessionStartIndex,
      selectedSessionDate: sessionDate,
      cursorIndex: startIndex,
      startMode,
      displayMode,
      workstationMode,
      sessions,
      cacheHit,
      visibility: opts?.visibility ?? this.store.snapshot().visibility
    });
    this.persistence.save(state);
    return history;
  }

  resolveStartIndex(history: ReplayHistory, mode: ReplayStartMode): number {
    return this.timeline.resolveStartIndex(history, mode);
  }

  buildDisplayContext(
    history: ReplayHistory,
    cursorIndex: number,
    reviewMode: boolean,
    state: Pick<ReplayWorkstationState, 'priorSessions' | 'sessionStartIndex' | 'visibility' | 'displayMode'>
  ): ReplayDisplayContext {
    const priorSessions = state.priorSessions ?? [];
    const merged = priorSessions.length
      ? this.multiDay.mergeContextCandles(priorSessions, history)
      : { candles: history.sessionCandles, sessionStartIndex: 0 };

    const studyOrReview = reviewMode || state.displayMode === 'REVIEW';
    const effectiveCursor = studyOrReview
      ? merged.candles.length - 1
      : state.sessionStartIndex + Math.max(0, cursorIndex);

    const timeline = this.filterTimeline(history.timeline, state.visibility);
    const visibleTimeline = studyOrReview
      ? timeline
      : timeline.filter(e => this.eventAtOrBefore(e, history, cursorIndex));

    return {
      candles: merged.candles,
      timeline: visibleTimeline,
      signals: visibleTimeline
        .filter(e => this.eventVisible(e, state.visibility))
        .map(e => this.eventToSignal(e, history.symbol)),
      cursorIndex: effectiveCursor,
      reviewMode: studyOrReview,
      sessionStartIndex: merged.sessionStartIndex
    };
  }

  setDisplayMode(mode: ReplayDisplayMode): void {
    const state = this.store.patch({ displayMode: mode });
    this.persistence.save(state);
  }

  setContextMode(mode: ReplayContextMode): void {
    const state = this.store.patch({ contextMode: mode });
    this.persistence.save(state);
  }

  setWorkstationMode(mode: ReplayWorkstationMode): void {
    const state = this.store.patch({ workstationMode: mode });
    this.persistence.save(state);
  }

  setStartMode(mode: ReplayStartMode): void {
    const state = this.store.patch({ startMode: mode });
    this.persistence.save(state);
  }

  setVisibility(partial: Partial<ReplaySignalVisibility>): void {
    const state = this.store.patch({
      visibility: { ...this.store.snapshot().visibility, ...partial }
    });
    this.persistence.save(state);
  }

  persistCursor(cursorIndex: number): void {
    const state = this.store.patch({ cursorIndex });
    this.persistence.save(state);
  }

  signalJump(kind: ReplaySignalJumpKind, cursorIndex: number): number | null {
    const history = this.store.snapshot().history;
    if (!history) return null;
    switch (kind) {
      case 'NEXT_SIGNAL': return this.timeline.jumpNextSignal(history, cursorIndex);
      case 'PREV_SIGNAL': return this.timeline.jumpPrevSignal(history, cursorIndex);
      case 'NEXT_ENTRY': return this.timeline.jumpNextEntry(history, cursorIndex);
      case 'PREV_ENTRY': return this.timeline.jumpPrevEntry(history, cursorIndex);
      case 'NEXT_TRAP': return this.timeline.jumpNextTrap(history, cursorIndex);
      case 'NEXT_RECLAIM': return this.timeline.jumpNextReclaim(history, cursorIndex);
      case 'NEXT_SECOND_LEG': return this.timeline.jumpNextSecondLeg(history, cursorIndex);
      default: return null;
    }
  }

  async signalJumpAdjacentSession(
    kind: ReplaySignalJumpKind,
    cursorIndex: number
  ): Promise<CrossSessionJumpTarget | null> {
    const ws = this.store.snapshot();
    if (!ws.selectedSessionDate || !ws.symbol) return null;

    const forward = kind.startsWith('NEXT_');
    const adjacent = forward
      ? this.navigation.nextSession(ws.sessions, ws.selectedSessionDate)
      : this.navigation.previousSession(ws.sessions, ws.selectedSessionDate);
    if (!adjacent?.sessionDate) return null;

    const { history } = await this.preload.loadSession(ws.symbol, adjacent.sessionDate);
    if (!history?.sessionCandles?.length) return null;

    const barIndex = forward
      ? this.timeline.jumpAtSessionStart(history, kind)
      : this.timeline.jumpAtSessionEnd(history, kind);
    if (barIndex == null) return null;

    return { sessionDate: adjacent.sessionDate, barIndex };
  }

  navigatePrevious(): string | null {
    const { sessions, selectedSessionDate } = this.store.snapshot();
    if (!selectedSessionDate) return null;
    return this.navigation.previousSession(sessions, selectedSessionDate)?.sessionDate ?? null;
  }

  navigateNext(): string | null {
    const { sessions, selectedSessionDate } = this.store.snapshot();
    if (!selectedSessionDate) return null;
    return this.navigation.nextSession(sessions, selectedSessionDate)?.sessionDate ?? null;
  }

  jumpToBestSetup(): string | null {
    return this.navigation.bestSetupSession(this.store.snapshot().sessions)?.sessionDate ?? null;
  }

  jumpToHighConviction(): string | null {
    return this.navigation.highConvictionSession(this.store.snapshot().sessions)?.sessionDate ?? null;
  }

  private buildCandles(
    history: ReplayHistory,
    priorSessions: ReplayHistory[]
  ): Candle[] {
    if (!priorSessions.length) return history.sessionCandles;
    return [...priorSessions.flatMap(s => s.sessionCandles), ...history.sessionCandles];
  }

  private filterTimeline(events: ReplaySignalEvent[], visibility: ReplaySignalVisibility): ReplaySignalEvent[] {
    return events.filter(e => this.eventVisible(e, visibility));
  }

  private eventVisible(e: ReplaySignalEvent, visibility: ReplaySignalVisibility): boolean {
    if (EXIT_TYPES.has(e.signalType)) return visibility.exits;
    if (e.signalType.includes('FAIL') || e.signalType.includes('TRAP')) return visibility.entries || visibility.exits;
    return visibility.entries;
  }

  private eventAtOrBefore(e: ReplaySignalEvent, history: ReplayHistory, cursorIndex: number): boolean {
    const cutoff = history.sessionCandles[cursorIndex]?.time;
    if (!cutoff) return false;
    return new Date(e.timestamp).getTime() <= new Date(cutoff).getTime();
  }

  private eventToSignal(e: ReplaySignalEvent, symbol: string): TradingSignal {
    return {
      symbol,
      signalType: e.signalType,
      timestamp: e.timestamp,
      price: e.price,
      rsi: null,
      lifecycleState: e.lifecycleState,
      confidenceScore: e.score ?? undefined,
      confidenceLabel: e.setupLabel ?? undefined,
      relativeVolume: e.rvol ?? undefined,
      vwap: e.vwap ?? undefined,
      signalReason: e.passedConditions?.join(' · '),
      extended: e.extended
    };
  }
}
