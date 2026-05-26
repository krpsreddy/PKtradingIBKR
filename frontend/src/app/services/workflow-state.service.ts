import { Injectable } from '@angular/core';
import { DEFAULT_WORKFLOW_FILTERS, WorkflowFilters, migrateLegacyWorkflowFilters } from '../models/workflow-filters.model';
import { BottomTabId } from '../models/analytics.model';

const PREFIX = 'trading.workflow.';

export interface WorkflowLayoutState {
  sidebarCollapsed: boolean;
  historyCollapsed: boolean;
  chartMode: 'LIVE' | 'REPLAY';
  focusMode: boolean;
  miniMode: boolean;
  activeTradeMode: boolean;
  panelState: Record<string, boolean>;
  filters: WorkflowFilters;
  recentSymbols: string[];
  sidebarWidth: number;
  bottomPanelHeight: number;
  bottomTab: BottomTabId | null;
  userExpandedBottom: boolean;
}

const DEFAULT_PANELS: Record<string, boolean> = {
  liveOpportunities: true,
  bestSetup: true,
  HIGH_CONVICTION_CONTINUATIONS: true,
  EARLY_EXPANSION: true,
  INSTITUTIONAL_PERSISTENCE: false,
  HEALTHY_SHALLOW_PULLBACKS: false,
  VWAP_ACCEPTANCE: false,
  COMPRESSION_BREAKOUTS: false,
  TREND_RESUMPTION: false,
  EXHAUSTION_AVOID: false,
  REGIME_TRANSITIONS: true,
  WATCHLIST_PRIORITIES: true,
  watchlist: true,
  marketInternals: true,
  marketStatus: false,
  emerging: true
};

@Injectable({ providedIn: 'root' })
export class WorkflowStateService {
  loadLayout(): Partial<WorkflowLayoutState> {
    try {
      const raw = localStorage.getItem(PREFIX + 'layout');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  saveLayout(state: Partial<WorkflowLayoutState>): void {
    const current = this.loadLayout();
    localStorage.setItem(PREFIX + 'layout', JSON.stringify({ ...current, ...state }));
  }

  loadFocusMode(): boolean {
    return this.loadLayout().focusMode ?? false;
  }

  saveFocusMode(focus: boolean): void {
    this.saveLayout({ focusMode: focus });
  }

  loadMiniMode(): boolean {
    return this.loadLayout().miniMode ?? false;
  }

  saveMiniMode(mini: boolean): void {
    this.saveLayout({ miniMode: mini });
  }

  loadActiveTradeMode(): boolean {
    const layout = this.loadLayout();
    if (layout.activeTradeMode === undefined) return true;
    return layout.activeTradeMode;
  }

  saveActiveTradeMode(active: boolean): void {
    this.saveLayout({ activeTradeMode: active });
  }

  loadRecentSymbols(): string[] {
    return this.loadLayout().recentSymbols ?? [];
  }

  pushRecentSymbol(symbol: string): string[] {
    const sym = symbol.toUpperCase();
    const recent = this.loadRecentSymbols().filter(s => s !== sym);
    recent.unshift(sym);
    const trimmed = recent.slice(0, 12);
    this.saveLayout({ recentSymbols: trimmed });
    return trimmed;
  }

  loadSidebarWidth(): number {
    return this.loadLayout().sidebarWidth ?? 380;
  }

  saveSidebarWidth(w: number): void {
    this.saveLayout({ sidebarWidth: Math.max(280, Math.min(520, w)) });
  }

  loadBottomHeight(): number {
    return this.loadLayout().bottomPanelHeight ?? 140;
  }

  saveBottomHeight(h: number): void {
    this.saveLayout({ bottomPanelHeight: Math.max(80, Math.min(320, h)) });
  }

  loadBottomTab(): BottomTabId | null {
    return this.loadLayout().bottomTab ?? null;
  }

  saveBottomTab(tab: BottomTabId | null): void {
    this.saveLayout({ bottomTab: tab });
  }

  loadUserExpandedBottom(): boolean {
    return this.loadLayout().userExpandedBottom ?? false;
  }

  saveUserExpandedBottom(v: boolean): void {
    this.saveLayout({ userExpandedBottom: v });
  }

  loadPanelState(): Record<string, boolean> {
    const layout = this.loadLayout();
    return { ...DEFAULT_PANELS, ...(layout.panelState ?? {}) };
  }

  savePanelState(key: string, open: boolean): void {
    const panels = this.loadPanelState();
    panels[key] = open;
    this.saveLayout({ panelState: panels });
  }

  loadFilters(): WorkflowFilters {
    const layout = this.loadLayout();
    const raw = (layout.filters ?? {}) as Record<string, boolean>;
    return migrateLegacyWorkflowFilters(raw);
  }

  saveFilters(filters: WorkflowFilters): void {
    this.saveLayout({ filters });
  }
}
