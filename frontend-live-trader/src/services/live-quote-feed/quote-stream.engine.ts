import { fetchQuotes } from '../../api';
import { quoteCache } from './quote-cache.store';

const FAST_MS = 1000;
const SLOW_MS = 1500;

function sameSymbols(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort().join(',');
  const sb = [...b].sort().join(',');
  return sa === sb;
}

export class QuoteStreamEngine {
  private fastTimer: ReturnType<typeof setInterval> | null = null;
  private slowTimer: ReturnType<typeof setInterval> | null = null;
  private fastSymbols: string[] = [];
  private slowSymbols: string[] = [];
  private fastInFlight = false;
  private slowInFlight = false;
  private enabled = false;

  start(
    getFast: () => string[],
    getSlow: () => string[],
    enabled: boolean
  ): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      return;
    }
    if (this.fastTimer) return;

    const refreshLists = () => {
      const nextFast = [...new Set(getFast().map(s => s.toUpperCase()).filter(Boolean))];
      const nextSlow = [...new Set(getSlow().map(s => s.toUpperCase()).filter(Boolean))];
      if (!sameSymbols(this.fastSymbols, nextFast)) this.fastSymbols = nextFast;
      if (!sameSymbols(this.slowSymbols, nextSlow)) this.slowSymbols = nextSlow;
    };

    const poll = async (symbols: string[], slot: 'fast' | 'slow') => {
      if (!this.enabled || symbols.length === 0) return;
      if (slot === 'fast' && this.fastInFlight) return;
      if (slot === 'slow' && this.slowInFlight) return;
      if (slot === 'fast') this.fastInFlight = true;
      else this.slowInFlight = true;
      try {
        const batch = await fetchQuotes(symbols);
        quoteCache.applyBatch(batch, true);
      } catch {
        quoteCache.applyBatch({}, false);
      } finally {
        if (slot === 'fast') this.fastInFlight = false;
        else this.slowInFlight = false;
      }
    };

    const tickFast = () => {
      refreshLists();
      void poll(this.fastSymbols, 'fast');
    };
    const tickSlow = () => {
      refreshLists();
      const slowOnly = this.slowSymbols.filter(s => !this.fastSymbols.includes(s));
      if (slowOnly.length) void poll(slowOnly, 'slow');
    };

    tickFast();
    tickSlow();
    this.fastTimer = setInterval(tickFast, FAST_MS);
    this.slowTimer = setInterval(tickSlow, SLOW_MS);
  }

  stop(): void {
    if (this.fastTimer) clearInterval(this.fastTimer);
    if (this.slowTimer) clearInterval(this.slowTimer);
    this.fastTimer = null;
    this.slowTimer = null;
    this.fastSymbols = [];
    this.slowSymbols = [];
    quoteCache.clear();
  }
}

export const quoteStreamEngine = new QuoteStreamEngine();
