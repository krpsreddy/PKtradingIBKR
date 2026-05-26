import { Injectable } from '@angular/core';

export interface WorkspaceLayoutInput {
  tradeMode: boolean;
  bottomExpanded: boolean;
  bottomTabActive: boolean;
  replayPanelVisible: boolean;
  hasLiveOpportunities: boolean;
  emergingCount: number;
  activeSignalCount: number;
  miniMode: boolean;
  focusMode: boolean;
  nextActionVisible: boolean;
  executionWorkspace: boolean;
}

export interface WorkspaceLayoutSnapshot {
  chartHeight: string;
  sidebarCompact: boolean;
  hideBottomIntel: boolean;
  fillMode: boolean;
  chartDominant: boolean;
  executionOverlay: boolean;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceAdaptiveLayoutService {
  resolve(input: WorkspaceLayoutInput): WorkspaceLayoutSnapshot {
    const noBottomPanels = input.executionWorkspace
      || (!input.bottomExpanded && !input.bottomTabActive && !input.replayPanelVisible);
    const sidebarMostlyEmpty = input.activeSignalCount <= 1 && input.emergingCount === 0;

    let chartHeight = 'min(62vh, 660px)';
    if (input.tradeMode && noBottomPanels) {
      chartHeight = input.nextActionVisible ? 'min(76vh, 900px)' : 'min(84vh, 980px)';
    } else if (input.executionWorkspace && noBottomPanels) {
      chartHeight = input.nextActionVisible ? 'min(74vh, 880px)' : 'min(78vh, 920px)';
    } else if (input.focusMode || input.miniMode) {
      chartHeight = 'min(54vh, 540px)';
    } else if (noBottomPanels) {
      chartHeight = 'min(66vh, 720px)';
    }

    return {
      chartHeight,
      sidebarCompact: input.tradeMode || sidebarMostlyEmpty,
      hideBottomIntel: !input.bottomExpanded,
      fillMode: noBottomPanels,
      chartDominant: input.tradeMode || noBottomPanels,
      executionOverlay: input.tradeMode
    };
  }
}
