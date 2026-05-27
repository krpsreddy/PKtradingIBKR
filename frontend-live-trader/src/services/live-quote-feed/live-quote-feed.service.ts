import { useEffect, useState } from 'react';
import type { QuoteFeedStatus, QuoteRow } from './quote-stream.models';
import { EMPTY_HISTORY, quoteCache } from './quote-cache.store';
import { quoteStreamEngine } from './quote-stream.engine';

export function startLiveQuoteFeed(
  getFastSymbols: () => string[],
  getSlowSymbols: () => string[],
  enabled: boolean
): void {
  quoteStreamEngine.start(getFastSymbols, getSlowSymbols, enabled);
}

export function stopLiveQuoteFeed(): void {
  quoteStreamEngine.stop();
}

function sameQuote(a: QuoteRow | undefined, b: QuoteRow | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.price === b.price &&
    a.change === b.change &&
    a.changePercent === b.changePercent &&
    a.stale === b.stale &&
    a.trend === b.trend
  );
}

export function useQuote(symbol: string | undefined): QuoteRow | undefined {
  const sym = symbol?.toUpperCase();
  const [row, setRow] = useState<QuoteRow | undefined>(() => (sym ? quoteCache.get(sym) : undefined));

  useEffect(() => {
    if (!sym) {
      setRow(undefined);
      return;
    }
    const sync = () => {
      const next = quoteCache.get(sym);
      setRow(prev => (sameQuote(prev, next) ? prev : next));
    };
    sync();
    return quoteCache.subscribeSymbol(sym, sync);
  }, [sym]);

  return row;
}

export function useQuoteHistory(symbol: string | undefined): readonly number[] {
  const sym = symbol?.toUpperCase();
  const [hist, setHist] = useState<readonly number[]>(() =>
    sym ? quoteCache.getHistory(sym) : EMPTY_HISTORY
  );

  useEffect(() => {
    if (!sym) {
      setHist(EMPTY_HISTORY);
      return;
    }
    const sync = () => {
      const next = quoteCache.getHistory(sym);
      setHist(prev => (prev === next ? prev : next));
    };
    sync();
    return quoteCache.subscribeSymbol(sym, sync);
  }, [sym]);

  return hist;
}

export function useQuoteFeedStatus(): QuoteFeedStatus {
  const [status, setStatus] = useState<QuoteFeedStatus>(() => quoteCache.getStatus());

  useEffect(() => {
    const sync = () => {
      const next = quoteCache.getStatus();
      setStatus(prev =>
        prev.connected === next.connected && prev.delayed === next.delayed ? prev : next
      );
    };
    sync();
    return quoteCache.subscribe(sync);
  }, []);

  return status;
}

export function formatPrice(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n >= 1000 ? n.toFixed(2) : n >= 100 ? n.toFixed(2) : n.toFixed(2);
}

export function formatChangePct(pct: number | undefined): string {
  if (pct == null || Number.isNaN(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatChange(chg: number | undefined): string {
  if (chg == null || Number.isNaN(chg)) return '';
  const sign = chg > 0 ? '+' : '';
  return `${sign}${chg.toFixed(2)}`;
}

export interface PositionMark {
  symbol: string;
  fillPrice?: number;
  entryPrice?: number;
  quantity?: number;
}

export interface LiveUnrealizedSnapshot {
  total: number;
  hasLive: boolean;
}

function computeLiveUnrealized(positions: PositionMark[]): LiveUnrealizedSnapshot {
  let total = 0;
  let hasLive = false;
  for (const p of positions) {
    const q = quoteCache.get(p.symbol);
    const entry = Number(p.fillPrice ?? p.entryPrice ?? 0);
    const qty = p.quantity ?? 0;
    if (q && entry > 0 && qty > 0) {
      total += (q.price - entry) * qty;
      hasLive = true;
    }
  }
  return { total, hasLive };
}

export function useLiveUnrealizedUsd(positions: PositionMark[]): LiveUnrealizedSnapshot {
  const key = positions.map(p => `${p.symbol}:${p.quantity}:${p.fillPrice ?? p.entryPrice}`).join('|');
  const [snap, setSnap] = useState<LiveUnrealizedSnapshot>(() => computeLiveUnrealized(positions));

  useEffect(() => {
    const sync = () => {
      const next = computeLiveUnrealized(positions);
      setSnap(prev => (prev.total === next.total && prev.hasLive === next.hasLive ? prev : next));
    };
    sync();
    return quoteCache.subscribe(sync);
  }, [key]);

  return snap;
}
