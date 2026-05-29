import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ReplayLoadPhase = 'A_CANDLES' | 'B_INDICATORS' | 'C_EXECUTION' | 'D_TELEMETRY' | 'IDLE';

export interface ReplayRequestRecord {
  endpoint: string;
  method: string;
  symbol?: string;
  durationMs: number;
  payloadBytes: number;
  cacheHit?: boolean;
  phase?: ReplayLoadPhase;
  at: number;
  slow: boolean;
}

export interface ReplayDiagnosticsSnapshot {
  requests: ReplayRequestRecord[];
  slowCount: number;
  duplicateCount: number;
  lastPhase: ReplayLoadPhase;
  memoryHintMb: number;
  activeSubscriptions: number;
}

const SLOW_MS = 500;
const MAX_RECORDS = 80;

/** Phase 193 — replay request profiling and UI freeze diagnostics. */
@Injectable({ providedIn: 'root' })
export class ReplayPerformanceDiagnosticsService {
  private readonly snapshotSubject = new BehaviorSubject<ReplayDiagnosticsSnapshot>(this.empty());
  readonly snapshot$ = this.snapshotSubject.asObservable();

  private records: ReplayRequestRecord[] = [];
  private lastPhase: ReplayLoadPhase = 'IDLE';
  private activeSubscriptions = 0;
  private readonly recentKeys = new Map<string, number>();

  beginPhase(phase: ReplayLoadPhase): void {
    this.lastPhase = phase;
    this.emit();
  }

  recordRequest(input: Omit<ReplayRequestRecord, 'at' | 'slow'>): void {
    const slow = input.durationMs >= SLOW_MS;
    const rec: ReplayRequestRecord = { ...input, at: Date.now(), slow };
    const dedupeKey = `${input.method}:${input.endpoint}`;
    const prev = this.recentKeys.get(dedupeKey);
    if (prev != null && Date.now() - prev < 300) {
      rec.slow = true;
    }
    this.recentKeys.set(dedupeKey, Date.now());
    this.records = [rec, ...this.records].slice(0, MAX_RECORDS);
    if (slow) {
      console.warn('[ReplayPerf]', rec.endpoint, `${rec.durationMs}ms`, `${rec.payloadBytes}b`);
    }
    this.emit();
  }

  trackSubscription(delta: number): void {
    this.activeSubscriptions = Math.max(0, this.activeSubscriptions + delta);
    this.emit();
  }

  reset(): void {
    this.records = [];
    this.recentKeys.clear();
    this.lastPhase = 'IDLE';
    this.emit();
  }

  snapshot(): ReplayDiagnosticsSnapshot {
    return this.snapshotSubject.value;
  }

  private emit(): void {
    const dup = this.countDuplicates();
    this.snapshotSubject.next({
      requests: [...this.records],
      slowCount: this.records.filter(r => r.slow).length,
      duplicateCount: dup,
      lastPhase: this.lastPhase,
      memoryHintMb: this.estimateMemoryMb(),
      activeSubscriptions: this.activeSubscriptions
    });
  }

  private countDuplicates(): number {
    const seen = new Set<string>();
    let dup = 0;
    for (const r of this.records) {
      const k = `${r.method}:${r.endpoint}`;
      if (seen.has(k)) dup++;
      seen.add(k);
    }
    return dup;
  }

  private estimateMemoryMb(): number {
    const perf = performance as Performance & { memory?: { usedJSHeapSize?: number } };
    const used = perf.memory?.usedJSHeapSize;
    if (used == null) {
      return 0;
    }
    return Math.round(used / (1024 * 1024));
  }

  private empty(): ReplayDiagnosticsSnapshot {
    return {
      requests: [],
      slowCount: 0,
      duplicateCount: 0,
      lastPhase: 'IDLE',
      memoryHintMb: 0,
      activeSubscriptions: 0
    };
  }
}
