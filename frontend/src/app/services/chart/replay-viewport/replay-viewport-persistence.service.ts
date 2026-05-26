import { Injectable } from '@angular/core';
import { LogicalRange, REPLAY_VIEWPORT_STORAGE_KEY } from './replay-viewport.models';

interface PersistedViewport {
  symbol: string;
  sessionDate: string;
  range: LogicalRange;
  savedAt: number;
}

@Injectable({ providedIn: 'root' })
export class ReplayViewportPersistenceService {
  load(symbol: string, sessionDate: string): LogicalRange | null {
    if (!symbol || !sessionDate) return null;
    try {
      const raw = sessionStorage.getItem(REPLAY_VIEWPORT_STORAGE_KEY);
      if (!raw) return null;
      const map = JSON.parse(raw) as Record<string, PersistedViewport>;
      const key = this.key(symbol, sessionDate);
      const entry = map[key];
      if (!entry || entry.symbol !== symbol || entry.sessionDate !== sessionDate) return null;
      return entry.range;
    } catch {
      return null;
    }
  }

  save(symbol: string, sessionDate: string, range: LogicalRange): void {
    if (!symbol || !sessionDate) return;
    try {
      const raw = sessionStorage.getItem(REPLAY_VIEWPORT_STORAGE_KEY);
      const map: Record<string, PersistedViewport> = raw ? JSON.parse(raw) : {};
      map[this.key(symbol, sessionDate)] = {
        symbol,
        sessionDate,
        range,
        savedAt: Date.now()
      };
      sessionStorage.setItem(REPLAY_VIEWPORT_STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* ignore quota */
    }
  }

  clear(symbol?: string, sessionDate?: string): void {
    if (!symbol || !sessionDate) {
      sessionStorage.removeItem(REPLAY_VIEWPORT_STORAGE_KEY);
      return;
    }
    try {
      const raw = sessionStorage.getItem(REPLAY_VIEWPORT_STORAGE_KEY);
      if (!raw) return;
      const map = JSON.parse(raw) as Record<string, PersistedViewport>;
      delete map[this.key(symbol, sessionDate)];
      sessionStorage.setItem(REPLAY_VIEWPORT_STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  private key(symbol: string, sessionDate: string): string {
    return `${symbol.toUpperCase()}::${sessionDate}`;
  }
}
