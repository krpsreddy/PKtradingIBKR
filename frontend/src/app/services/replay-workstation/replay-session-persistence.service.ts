import { Injectable } from '@angular/core';
import { ReplayContextMode } from '../replay-decision-visualization/replay-decision-visualization.models';
import {
  DEFAULT_SIGNAL_VISIBILITY,
  DEFAULT_WORKSTATION_STATE,
  ReplayDisplayMode,
  ReplaySignalVisibility,
  ReplayStartMode,
  ReplayWorkstationMode,
  ReplayWorkstationState
} from './replay-workstation.models';

const STORAGE_KEY = 'replay-workstation-v1';

interface PersistedWorkstation {
  symbol: string;
  sessionDate: string;
  cursorIndex: number;
  displayMode: ReplayDisplayMode;
  workstationMode: ReplayWorkstationMode;
  contextMode: ReplayContextMode;
  startMode: ReplayStartMode;
  visibility: ReplaySignalVisibility;
}

@Injectable({ providedIn: 'root' })
export class ReplaySessionPersistenceService {
  save(state: ReplayWorkstationState): void {
    if (!state.symbol || !state.selectedSessionDate) return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const map: Record<string, PersistedWorkstation> = raw ? JSON.parse(raw) : {};
      map[state.symbol.toUpperCase()] = {
        symbol: state.symbol.toUpperCase(),
        sessionDate: state.selectedSessionDate,
        cursorIndex: state.cursorIndex,
        displayMode: state.displayMode,
        workstationMode: state.workstationMode,
        contextMode: state.contextMode,
        startMode: state.startMode,
        visibility: state.visibility
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  load(symbol: string): Partial<ReplayWorkstationState> | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const map = JSON.parse(raw) as Record<string, PersistedWorkstation>;
      const entry = map[symbol.toUpperCase()];
      if (!entry) return null;
      return {
        selectedSessionDate: entry.sessionDate,
        cursorIndex: entry.cursorIndex,
        displayMode: entry.displayMode,
        workstationMode: entry.workstationMode,
        contextMode: entry.contextMode ?? 'PREVIOUS_DAY',
        startMode: entry.startMode,
        visibility: entry.visibility ?? { ...DEFAULT_SIGNAL_VISIBILITY }
      };
    } catch {
      return null;
    }
  }

  clear(symbol?: string): void {
    if (!symbol) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const map = JSON.parse(raw) as Record<string, PersistedWorkstation>;
      delete map[symbol.toUpperCase()];
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }
}

