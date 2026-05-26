import { Injectable } from '@angular/core';
import { ReplayHistory, ReplaySignalEvent } from '../../models/replay.model';
import { ReplayDecisionTimelineRow } from '../replay-decision-visualization/replay-decision-visualization.models';
import { ReplaySignalJumpKind } from './replay-workstation.models';
import {
  DEFAULT_PANEL_LAYOUT,
  ReplayBreadcrumb,
  ReplayPanelLayoutState,
  ReplayPanelTab,
  ReplaySnapRequest,
  ReplayUxStatus
} from './replay-ux.models';
import { ReplayFocusManagerService } from './replay-focus-manager.service';
import { ReplayInteractionFeedbackEngine } from './replay-interaction-feedback.engine';
import { ReplayLoadingStateEngine } from './replay-loading-state.engine';
import { ReplayNavigationUxEngine } from './replay-navigation-ux.engine';
import { ReplayPanelLayoutEngine } from './replay-panel-layout.engine';
import { ReplayTransitionStateService } from './replay-transition-state.service';

export type SnapHandler = (barIndex: number, animate: boolean) => void;

/** Phase 154 — replay UX orchestration (navigation, feedback, layout). */
@Injectable({ providedIn: 'root' })
export class ReplayWorkstationUxSynthesisService {
  private snapHandler: SnapHandler | null = null;

  constructor(
    private transition: ReplayTransitionStateService,
    private focus: ReplayFocusManagerService,
    private loading: ReplayLoadingStateEngine,
    private feedback: ReplayInteractionFeedbackEngine,
    private navigation: ReplayNavigationUxEngine,
    private layoutEngine: ReplayPanelLayoutEngine
  ) {}

  get state$() {
    return this.transition.state$;
  }

  snapshot() {
    return this.transition.snapshot();
  }

  registerSnapHandler(handler: SnapHandler): void {
    this.snapHandler = handler;
  }

  onSessionLoadStart(symbol: string, sessionDate: string): void {
    this.transition.setStatus('LOADING_SESSION');
    this.transition.setFeedback(this.loading.sessionLoadMessage(symbol, sessionDate));
  }

  onSessionLoadComplete(reviewMode: boolean, playing: boolean): void {
    this.transition.setStatus(this.loading.statusForLoading(false, playing, reviewMode));
    this.transition.setFeedback(null);
  }

  onSymbolChange(symbol: string): void {
    this.transition.setStatus('LOADING_SESSION');
    this.transition.setFeedback(this.loading.feedbackForAction('symbol', `Switching to ${symbol}…`));
  }

  requestSnap(barIndex: number, reason: string, highlight = true): void {
    const req: ReplaySnapRequest = { barIndex, reason, animate: true, highlight };
    this.transition.setFeedback(this.loading.snapMessage(reason));
    this.transition.lockViewport();
    this.transition.scheduleSnap(req, r => {
      this.snapHandler?.(r.barIndex, r.animate ?? true);
      setTimeout(() => this.transition.clearFocusPulse(), 600);
    });
  }

  onSignalJump(kind: ReplaySignalJumpKind, barIndex: number | null): void {
    if (barIndex == null) return;
    this.requestSnap(barIndex, this.feedback.jumpLabel(kind));
  }

  onJumpBoundary(kind: ReplaySignalJumpKind): void {
    this.transition.clearPendingSnap();
    this.transition.setStatus('READY');
    this.transition.setFeedback(
      this.loading.feedbackForAction(
        'jump',
        `No ${this.feedback.jumpLabel(kind)} in this session — loaded adjacent sessions via ◀ ▶ or run hydration`
      )
    );
    setTimeout(() => this.transition.setFeedback(null), 4000);
  }

  clearPendingSnap(): void {
    this.transition.clearPendingSnap();
    this.transition.setStatus('READY');
  }

  updateBreadcrumb(
    symbol: string,
    history: ReplayHistory | null,
    barIndex: number,
    selectedEvent: ReplaySignalEvent | null,
    decisionRows: ReplayDecisionTimelineRow[]
  ): ReplayBreadcrumb | null {
    return this.navigation.buildBreadcrumb(symbol, history, barIndex, selectedEvent, decisionRows);
  }

  updateDebug(
    replayIndex: number,
    visibleFrom: number | null,
    visibleTo: number | null,
    focusedSignal: string | null,
    autoFollow: boolean
  ): void {
    this.transition.setDebug({
      replayIndex,
      visibleFrom,
      visibleTo,
      focusedSignal,
      autoFollow,
      viewportLock: this.snapshot().viewportLocked
    });
  }

  setStatus(status: ReplayUxStatus): void {
    this.transition.setStatus(status);
  }

  openTab(tab: ReplayPanelTab): ReplayPanelLayoutState {
    const next = this.layoutEngine.openTab(this.snapshot().layout, tab);
    this.transition.setLayout(next);
    return next;
  }

  togglePinTab(tab: ReplayPanelTab): void {
    this.transition.setLayout(this.layoutEngine.togglePin(this.snapshot().layout, tab));
  }

  toggleBottomPanel(): void {
    this.transition.setLayout(this.layoutEngine.toggleBottom(this.snapshot().layout));
  }

  reset(): void {
    this.transition.reset();
  }
}
