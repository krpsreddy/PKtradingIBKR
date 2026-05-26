import { Injectable } from '@angular/core';
import { ReplayHistory } from '../../../models/replay.model';
import { REPLAY_CACHE_STORAGE_KEY, ReplayCacheState } from './replay-cache.models';

/** Phase 149 — local replay snapshot cache for fast hydration. */
@Injectable({ providedIn: 'root' })
export class ReplaySnapshotStoreService {
  private readonly bySymbol = new Map<string, Map<string, ReplayHistory>>();

  constructor() {
    this.loadFromStorage();
  }

  get(symbol: string, sessionDate: string): ReplayHistory | null {
    return this.bySymbol.get(symbol.toUpperCase())?.get(sessionDate) ?? null;
  }

  allSymbols(): string[] {
    return [...this.bySymbol.keys()];
  }

  getSymbolSessions(symbol: string): ReplayHistory[] {
    const map = this.bySymbol.get(symbol.toUpperCase());
    if (!map) return [];
    return [...map.values()].sort((a, b) => a.replayDate.localeCompare(b.replayDate));
  }

  merge(symbol: string, sessions: ReplayHistory[]): void {
    const sym = symbol.toUpperCase();
    const map = this.bySymbol.get(sym) ?? new Map<string, ReplayHistory>();
    for (const s of sessions) {
      if (s.replayDate) map.set(s.replayDate, s);
    }
    this.bySymbol.set(sym, map);
    this.persist();
  }

  state(symbol: string): ReplayCacheState {
    const sessions = this.getSymbolSessions(symbol);
    return {
      symbol: symbol.toUpperCase(),
      readySessions: sessions.length,
      staleSessions: 0,
      missingSessions: 0,
      lastLoadedAt: sessions.length ? Date.now() : null,
      cacheHit: sessions.length > 0
    };
  }

  clear(symbol?: string): void {
    if (symbol) {
      this.bySymbol.delete(symbol.toUpperCase());
    } else {
      this.bySymbol.clear();
    }
    this.persist();
  }

  private persist(): void {
    try {
      const payload: Record<string, ReplayHistory[]> = {};
      for (const [sym, map] of this.bySymbol.entries()) {
        payload[sym] = [...map.values()];
      }
      localStorage.setItem(REPLAY_CACHE_STORAGE_KEY, JSON.stringify({ version: 1, data: payload, savedAt: Date.now() }));
    } catch {
      // ignore quota errors
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(REPLAY_CACHE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { data?: Record<string, ReplayHistory[]> };
      for (const [sym, sessions] of Object.entries(parsed.data ?? {})) {
        const map = new Map<string, ReplayHistory>();
        for (const s of sessions) {
          if (s.replayDate) map.set(s.replayDate, s);
        }
        this.bySymbol.set(sym, map);
      }
    } catch {
      // ignore corrupt cache
    }
  }
}
