import { Injectable } from '@angular/core';

export const STORAGE_SELECTED_SYMBOL = 'trading.selected.symbol';
export const STORAGE_CUSTOM_WATCHLIST = 'trading.watchlist.custom';

@Injectable({ providedIn: 'root' })
export class WatchlistStoreService {

  getSelectedSymbol(): string | null {
    return localStorage.getItem(STORAGE_SELECTED_SYMBOL)
      ?? localStorage.getItem('trading-dashboard-selected-symbol');
  }

  setSelectedSymbol(symbol: string): void {
    localStorage.setItem(STORAGE_SELECTED_SYMBOL, symbol.toUpperCase());
  }

  /** One-time migration of legacy UI keys (not watchlist symbols). */
  migrateLegacyKeys(): void {
    const legacySelected = localStorage.getItem('trading-dashboard-selected-symbol');
    if (legacySelected && !localStorage.getItem(STORAGE_SELECTED_SYMBOL)) {
      localStorage.setItem(STORAGE_SELECTED_SYMBOL, legacySelected.toUpperCase());
    }
  }

  /** Returns legacy custom symbols once, then clears local storage ownership. */
  consumeLegacyCustomSymbols(): string[] {
    const keys = [STORAGE_CUSTOM_WATCHLIST, 'trading-dashboard-session-symbols'];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as string[];
        localStorage.removeItem(key);
        if (Array.isArray(parsed)) {
          return parsed.map(s => s.toUpperCase()).filter(Boolean);
        }
      } catch { /* ignore */ }
    }
    return [];
  }
}
