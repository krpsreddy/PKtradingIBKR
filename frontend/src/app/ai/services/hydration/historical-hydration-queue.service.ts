import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  HYDRATION_PARALLEL_MAX,
  HYDRATION_PARALLEL_SYMBOLS,
  HYDRATION_QUEUE_STORAGE_KEY,
  HydrationJobResult,
  HydrationQueueState
} from './symbol-history-hydration.models';

export interface HydrationQueueJob {
  symbol: string;
  lookbackDays: number;
  autoAnalyze: boolean;
  force: boolean;
  retries: number;
  state: HydrationQueueState;
}

export type HydrationWorker = (job: HydrationQueueJob) => Promise<HydrationJobResult>;

/** Parallel hydration queue — bounded worker pool, retry, skip-loaded. */
@Injectable({ providedIn: 'root' })
export class HistoricalHydrationQueueService {
  private queue: HydrationQueueJob[] = [];
  private processing = false;
  private worker: HydrationWorker | null = null;
  private avgJobMs = 45_000;
  private maxConcurrency = HYDRATION_PARALLEL_SYMBOLS;

  private readonly queueSubject = new BehaviorSubject<HydrationQueueJob[]>([]);
  readonly queue$ = this.queueSubject.asObservable();

  constructor() {
    this.loadQueueFromStorage();
  }

  setWorker(worker: HydrationWorker): void {
    this.worker = worker;
  }

  setMaxConcurrency(n: number): void {
    this.maxConcurrency = Math.max(1, Math.min(HYDRATION_PARALLEL_MAX, n));
  }

  maxParallelism(): number {
    return this.maxConcurrency;
  }

  /** Drop stale pending jobs for symbols about to be scanned in a new bulk run. */
  clearPendingForSymbols(symbols: string[]): void {
    const targets = new Set(symbols.map(s => s.toUpperCase()));
    this.queue = this.queue.filter(j => !targets.has(j.symbol));
    this.persistQueue();
    this.emitQueue();
  }

  pendingCount(): number {
    return this.queue.filter(j => j.state === 'QUEUED' || j.state === 'RETRYING').length;
  }

  activeSymbols(): string[] {
    return this.queue.filter(j => j.state === 'LOADING').map(j => j.symbol);
  }

  enqueue(jobs: Omit<HydrationQueueJob, 'retries' | 'state'>[]): number {
    let added = 0;
    for (const job of jobs) {
      const sym = job.symbol.toUpperCase();
      if (this.queue.some(j => j.symbol === sym) || this.isActive(sym)) continue;
      this.queue.push({ ...job, symbol: sym, retries: 0, state: 'QUEUED' });
      added++;
    }
    this.persistQueue();
    this.emitQueue();
    void this.processQueue();
    return added;
  }

  retry(symbol: string, lookbackDays: number, autoAnalyze: boolean): void {
    this.enqueue([{ symbol, lookbackDays, autoAnalyze, force: true }]);
  }

  queueSize(): number {
    return this.queue.filter(j => j.state === 'QUEUED' || j.state === 'RETRYING' || j.state === 'LOADING').length;
  }

  snapshot(): HydrationQueueJob[] {
    return [...this.queue];
  }

  currentJob(): HydrationQueueJob | null {
    return this.queue.find(j => j.state === 'LOADING') ?? null;
  }

  clearCompleted(): void {
    const active = this.queue.filter(j => j.state !== 'READY' && j.state !== 'SKIPPED' && j.state !== 'FAILED');
    this.queue.length = 0;
    this.queue.push(...active);
    this.persistQueue();
    this.emitQueue();
  }

  estimatedRemainingMs(): number | null {
    const pending = this.queue.filter(j => j.state === 'QUEUED' || j.state === 'RETRYING').length;
    const loading = this.queue.filter(j => j.state === 'LOADING').length;
    const total = pending + loading;
    if (total <= 0) return null;
    const batches = Math.ceil(total / Math.max(1, this.maxConcurrency));
    return batches * this.avgJobMs;
  }

  isRunning(): boolean {
    return this.processing || this.queue.some(j =>
      j.state === 'LOADING' || j.state === 'QUEUED' || j.state === 'RETRYING'
    );
  }

  private isActive(sym: string): boolean {
    return this.queue.some(j => j.symbol === sym && (j.state === 'LOADING' || j.state === 'RETRYING'));
  }

  private claimNext(): HydrationQueueJob | null {
    const job = this.queue.find(j => j.state === 'QUEUED' || j.state === 'RETRYING');
    if (!job) return null;
    job.state = 'LOADING';
    this.emitQueue();
    return job;
  }

  private async processQueue(): Promise<void> {
    if (this.processing || !this.worker) return;
    this.processing = true;

    const workers = Array.from({ length: this.maxConcurrency }, () => this.workerLoop());
    await Promise.all(workers);

    this.processing = false;
    this.queue = this.queue.filter(j => j.state === 'QUEUED' || j.state === 'RETRYING' || j.state === 'LOADING');
    this.persistQueue();
    this.emitQueue();
  }

  private async workerLoop(): Promise<void> {
    while (this.worker) {
      const job = this.claimNext();
      if (!job) break;

      const started = Date.now();
      try {
        const result = await this.worker(job);
        job.state = result.skipped ? 'SKIPPED' : 'READY';
        const elapsed = Date.now() - started;
        this.avgJobMs = Math.round(this.avgJobMs * 0.7 + elapsed * 0.3);
        if (elapsed < 8_000 && this.maxConcurrency < HYDRATION_PARALLEL_MAX) {
          this.maxConcurrency = Math.min(HYDRATION_PARALLEL_MAX, this.maxConcurrency + 1);
        } else if (elapsed > 60_000 && this.maxConcurrency > 2) {
          this.maxConcurrency = Math.max(2, this.maxConcurrency - 1);
        }
      } catch {
        job.retries += 1;
        job.state = job.retries < 2 ? 'RETRYING' : 'FAILED';
      }

      this.persistQueue();
      this.emitQueue();
    }
  }

  private emitQueue(): void {
    this.queueSubject.next([...this.queue]);
  }

  private persistQueue(): void {
    try {
      localStorage.setItem(
        HYDRATION_QUEUE_STORAGE_KEY,
        JSON.stringify({ version: 1, jobs: this.queue, savedAt: Date.now() })
      );
    } catch {
      // ignore
    }
  }

  private loadQueueFromStorage(): void {
    try {
      const raw = localStorage.getItem(HYDRATION_QUEUE_STORAGE_KEY);
      if (!raw) return;
      localStorage.removeItem(HYDRATION_QUEUE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
