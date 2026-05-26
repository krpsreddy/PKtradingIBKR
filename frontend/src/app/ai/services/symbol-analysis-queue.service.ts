import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SymbolAnalysisJobOptions, SymbolAnalysisStatus } from '../models/symbol-edge.models';
import { SymbolEdgeAnalysisService } from './symbol-edge-analysis.service';
import { SymbolEdgeProfileStore } from './symbol-edge-profile.store';

interface QueuedJob {
  symbol: string;
  options: SymbolAnalysisJobOptions;
}

@Injectable({ providedIn: 'root' })
export class SymbolAnalysisQueueService {
  private readonly queue: QueuedJob[] = [];
  private readonly activeSymbols = new Set<string>();
  private processing = false;

  private readonly statusSubject = new BehaviorSubject<Map<string, SymbolAnalysisStatus>>(new Map());
  readonly statusMap$ = this.statusSubject.asObservable();

  constructor(
    private edgeService: SymbolEdgeAnalysisService,
    private profileStore: SymbolEdgeProfileStore
  ) {}

  getStatus(symbol: string): SymbolAnalysisStatus {
    const sym = symbol.toUpperCase();
    return this.statusSubject.value.get(sym)
      ?? this.profileStore.get(sym)?.status
      ?? 'IDLE';
  }

  isQueuedOrRunning(symbol: string): boolean {
    const sym = symbol.toUpperCase();
    const status = this.getStatus(sym);
    return this.activeSymbols.has(sym)
      || status === 'QUEUED'
      || status === 'LOADING_HISTORY'
      || status === 'EVALUATING'
      || status === 'ANALYZING_AI';
  }

  queueLength(): number {
    return this.queue.length + this.activeSymbols.size;
  }

  /** Enqueue a single symbol for history load + analysis. */
  enqueue(symbol: string, options: SymbolAnalysisJobOptions = {}): void {
    const sym = symbol.toUpperCase();
    if (this.activeSymbols.has(sym) || this.queue.some(j => j.symbol === sym)) {
      return;
    }
    this.setStatus(sym, 'QUEUED');
    this.queue.push({ symbol: sym, options });
    void this.processQueue();
  }

  /** Enqueue all watchlist symbols sequentially — one Ollama call at a time. */
  enqueueWatchlist(symbols: string[], options: SymbolAnalysisJobOptions = {}): void {
    const unique = [...new Set(symbols.map(s => s.toUpperCase()))];
    for (const sym of unique) {
      if (!this.activeSymbols.has(sym) && !this.queue.some(j => j.symbol === sym)) {
        this.setStatus(sym, 'QUEUED');
        this.queue.push({ symbol: sym, options: { ...options, loadHistory: options.loadHistory ?? false } });
      }
    }
    void this.processQueue();
  }

  /** Load history + analyze for a single symbol (immediate queue). */
  enqueueFullPipeline(symbol: string, forceRefresh = false): void {
    this.enqueue(symbol, { loadHistory: true, forceRefresh });
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      const sym = job.symbol;
      this.activeSymbols.add(sym);

      try {
        if (job.options.loadHistory) {
          this.setStatus(sym, 'LOADING_HISTORY');
          await this.edgeService.loadHistory(sym);
        }

        this.setStatus(sym, 'EVALUATING');
        await this.edgeService.analyzeSymbol(sym, { forceRefresh: job.options.forceRefresh ?? false });
        this.setStatus(sym, 'READY');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        this.profileStore.updateStatus(sym, 'FAILED', message, message);
        this.setStatus(sym, 'FAILED');
      } finally {
        this.activeSymbols.delete(sym);
      }
    }

    this.processing = false;
  }

  private setStatus(symbol: string, status: SymbolAnalysisStatus): void {
    const next = new Map(this.statusSubject.value);
    next.set(symbol.toUpperCase(), status);
    this.statusSubject.next(next);
    if (status !== 'QUEUED') {
      this.profileStore.updateStatus(symbol, status);
    }
  }
}
