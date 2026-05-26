import { Injectable } from '@angular/core';
import { DEFAULT_PANEL_LAYOUT, ReplayPanelLayoutState, ReplayPanelTab } from './replay-ux.models';

@Injectable({ providedIn: 'root' })
export class ReplayPanelLayoutEngine {
  openTab(state: ReplayPanelLayoutState, tab: ReplayPanelTab): ReplayPanelLayoutState {
    if (state.pinnedTab === tab) {
      return { ...state, activeTab: tab, bottomExpanded: true };
    }
    return {
      ...state,
      activeTab: tab,
      bottomExpanded: true
    };
  }

  togglePin(state: ReplayPanelLayoutState, tab: ReplayPanelTab): ReplayPanelLayoutState {
    const pinnedTab = state.pinnedTab === tab ? null : tab;
    return { ...state, pinnedTab, activeTab: tab };
  }

  collapseOthers(state: ReplayPanelLayoutState, tab: ReplayPanelTab): ReplayPanelLayoutState {
    if (state.pinnedTab && state.pinnedTab !== tab) {
      return { ...state, activeTab: tab };
    }
    return { ...state, activeTab: tab, bottomExpanded: true };
  }

  toggleBottom(state: ReplayPanelLayoutState): ReplayPanelLayoutState {
    return { ...state, bottomExpanded: !state.bottomExpanded };
  }

  reset(): ReplayPanelLayoutState {
    return { ...DEFAULT_PANEL_LAYOUT };
  }
}
