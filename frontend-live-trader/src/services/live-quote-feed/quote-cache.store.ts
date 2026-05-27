import type { ApiQuote, QuoteBatch, QuoteFeedStatus, QuoteRow, TrendDirection } from './quote-stream.models';

const HISTORY_LEN = 20;

/** Stable empty history — must not allocate new [] per read (useSyncExternalStore / React 19). */
export const EMPTY_HISTORY: readonly number[] = [];

function trendFromHistory(prev: number | undefined, next: number): TrendDirection {
  if (prev == null || prev === next) return 'flat';
  return next > prev ? 'up' : 'down';
}

function toRow(q: ApiQuote, prevPrice?: number): QuoteRow {
  const change = q.change ?? 0;
  const changePercent = q.changePercent ?? 0;
  const trend: TrendDirection =
    changePercent > 0.01 ? 'up' : changePercent < -0.01 ? 'down' : trendFromHistory(prevPrice, q.price);
  return {
    price: q.price,
    change,
    changePercent,
    volume: q.volume,
    timestamp: q.timestamp,
    stale: q.stale,
    trend
  };
}

export class QuoteCacheStore {
  private quotes = new Map<string, QuoteRow>();
  private history = new Map<string, number[]>();
  private globalListeners = new Set<() => void>();
  private symbolListeners = new Map<string, Set<() => void>>();
  private status: QuoteFeedStatus = { connected: true, delayed: false, lastFetchAt: null };

  get(symbol: string): QuoteRow | undefined {
    return this.quotes.get(symbol.toUpperCase());
  }

  getHistory(symbol: string): readonly number[] {
    return this.history.get(symbol.toUpperCase()) ?? [];
  }

  getStatus(): QuoteFeedStatus {
    return this.status;
  }

  subscribe(listener: () => void): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  subscribeSymbol(symbol: string, listener: () => void): () => void {
    const sym = symbol.toUpperCase();
    let set = this.symbolListeners.get(sym);
    if (!set) {
      set = new Set();
      this.symbolListeners.set(sym, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.symbolListeners.delete(sym);
    };
  }

  applyBatch(batch: QuoteBatch, fetchOk: boolean): void {
    const changed = new Set<string>();
    let anyStale = false;

    for (const [raw, q] of Object.entries(batch)) {
      const sym = raw.toUpperCase();
      const prev = this.quotes.get(sym);
      const row = toRow(q, prev?.price);
      if (
        !prev ||
        prev.price !== row.price ||
        prev.changePercent !== row.changePercent ||
        prev.stale !== row.stale
      ) {
        this.quotes.set(sym, row);
        changed.add(sym);
      }
      const hist = this.history.get(sym) ?? [];
      const last = hist[hist.length - 1];
      if (last !== q.price) {
        const next = [...hist, q.price].slice(-HISTORY_LEN);
        this.history.set(sym, next);
        if (!changed.has(sym)) changed.add(sym);
      }
      if (q.stale) anyStale = true;
    }

    const prevDelayed = this.status.delayed;
    const prevConnected = this.status.connected;
    const nextDelayed = !fetchOk || anyStale;
    this.status.connected = fetchOk;
    this.status.delayed = nextDelayed;
    this.status.lastFetchAt = Date.now();

    for (const sym of changed) {
      const listeners = this.symbolListeners.get(sym);
      if (listeners) listeners.forEach(l => l());
    }
    if (changed.size > 0 || prevDelayed !== nextDelayed || prevConnected !== fetchOk) {
      this.globalListeners.forEach(l => l());
    }
  }

  clear(): void {
    this.quotes.clear();
    this.history.clear();
    this.status.connected = true;
    this.status.delayed = false;
    this.status.lastFetchAt = null;
    this.globalListeners.forEach(l => l());
  }
}

export const quoteCache = new QuoteCacheStore();
