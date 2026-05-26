import { WatchlistItem } from '../models/workspace.model';

export type SearchMatchKind = 'exact' | 'startsWith' | 'contains';

export interface RankedWatchlistItem<T extends { symbol: string }> {
  item: T;
  rank: number;
}

export function rankWatchlistSearch<T extends { symbol: string }>(items: T[], query: string): T[] {
  const q = query.trim().toUpperCase();
  if (!q) {
    return [...items];
  }
  const ranked: RankedWatchlistItem<T>[] = [];
  for (const item of items) {
    const sym = item.symbol.toUpperCase();
    if (!sym.includes(q)) {
      continue;
    }
    let rank = 3;
    if (sym === q) rank = 0;
    else if (sym.startsWith(q)) rank = 1;
    ranked.push({ item, rank });
  }
  ranked.sort((a, b) => a.rank - b.rank || a.item.symbol.localeCompare(b.item.symbol));
  return ranked.map(r => r.item);
}

export function splitSymbolHighlight(symbol: string, query: string): { text: string; match: boolean }[] {
  const q = query.trim().toUpperCase();
  const sym = symbol.toUpperCase();
  if (!q || !sym.includes(q)) {
    return [{ text: symbol, match: false }];
  }
  const idx = sym.indexOf(q);
  const parts: { text: string; match: boolean }[] = [];
  if (idx > 0) parts.push({ text: symbol.slice(0, idx), match: false });
  parts.push({ text: symbol.slice(idx, idx + q.length), match: true });
  if (idx + q.length < symbol.length) {
    parts.push({ text: symbol.slice(idx + q.length), match: false });
  }
  return parts;
}

export function isValidTicker(symbol: string): boolean {
  return /^[A-Z]{1,5}$/.test(symbol.trim().toUpperCase());
}
