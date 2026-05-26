import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface NetworkRequestMetric {
  key: string;
  method: string;
  url: string;
  startedAt: number;
  completedAt?: number;
  status?: 'ok' | 'error' | 'cancelled' | 'deduped' | 'cached';
  durationMs?: number;
}

export interface NetworkDiagnosticsSnapshot {
  requestsPerSec: number;
  pending: number;
  cacheHitRate: number;
  droppedStale: number;
  deduped: number;
  maxConcurrent: number;
  feedTransport: 'sse' | 'poll' | 'idle';
  recent: NetworkRequestMetric[];
}

/** Dev observability for request storms and cache effectiveness. */
@Injectable({ providedIn: 'root' })
export class NetworkDiagnosticsService {
  private readonly maxRecent = 40;
  private readonly recent: NetworkRequestMetric[] = [];
  private pending = 0;
  private droppedStale = 0;
  private deduped = 0;
  private requestTimestamps: number[] = [];
  private cacheHitRate = 0;
  private feedTransport: 'sse' | 'poll' | 'idle' = 'idle';
  private maxConcurrent = 0;

  private readonly snapshotSubject = new BehaviorSubject<NetworkDiagnosticsSnapshot>(this.empty());
  readonly snapshot$ = this.snapshotSubject.asObservable();

  recordStart(key: string, method: string, url: string): void {
    this.pending++;
    this.maxConcurrent = Math.max(this.maxConcurrent, this.pending);
    const now = Date.now();
    this.requestTimestamps.push(now);
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 10_000);
    const metric: NetworkRequestMetric = { key, method, url, startedAt: now };
    this.recent.unshift(metric);
    if (this.recent.length > this.maxRecent) this.recent.pop();
    this.emit();
  }

  recordEnd(key: string, status: NetworkRequestMetric['status'] = 'ok'): void {
    this.pending = Math.max(0, this.pending - 1);
    const metric = this.recent.find(m => m.key === key && !m.completedAt);
    if (metric) {
      metric.completedAt = Date.now();
      metric.status = status;
      metric.durationMs = metric.completedAt - metric.startedAt;
    }
    this.emit();
  }

  recordDeduped(): void {
    this.deduped++;
    this.emit();
  }

  recordDroppedStale(): void {
    this.droppedStale++;
    this.emit();
  }

  setCacheHitRate(rate: number): void {
    this.cacheHitRate = rate;
    this.emit();
  }

  setFeedTransport(t: 'sse' | 'poll' | 'idle'): void {
    this.feedTransport = t;
    this.emit();
  }

  snapshot(): NetworkDiagnosticsSnapshot {
    return this.snapshotSubject.value;
  }

  private emit(): void {
    const now = Date.now();
    const rps = this.requestTimestamps.filter(t => now - t < 1000).length;
    this.snapshotSubject.next({
      requestsPerSec: rps,
      pending: this.pending,
      cacheHitRate: this.cacheHitRate,
      droppedStale: this.droppedStale,
      deduped: this.deduped,
      maxConcurrent: this.maxConcurrent,
      feedTransport: this.feedTransport,
      recent: [...this.recent]
    });
  }

  private empty(): NetworkDiagnosticsSnapshot {
    return {
      requestsPerSec: 0,
      pending: 0,
      cacheHitRate: 0,
      droppedStale: 0,
      deduped: 0,
      maxConcurrent: 0,
      feedTransport: 'idle',
      recent: []
    };
  }
}
