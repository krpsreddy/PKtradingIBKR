import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SignalAnalyticsSnapshot,
  SignalIntelligenceFilter,
  SignalSnapshot,
  SIGNAL_INTELLIGENCE_STORAGE_KEY
} from '../../models/signal-intelligence.model';
import { normalizeSignalSnapshot } from './signal-intelligence.math';

const MAX_STORED_SIGNALS = 5000;

@Injectable({ providedIn: 'root' })
export class SignalIntelligenceStore {
  private readonly signals = new Map<string, SignalSnapshot>();
  private readonly revisionSubject = new BehaviorSubject<number>(0);
  private bulkImportDepth = 0;
  private bulkRevisionPending = false;
  private bulkPersistPending = false;

  /** Emits store revision on every mutation — subscribe to refresh analytics. */
  readonly revision$ = this.revisionSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  revision(): number {
    return this.revisionSubject.value;
  }

  all(): SignalSnapshot[] {
    return [...this.signals.values()].sort((a, b) => b.timestamp - a.timestamp);
  }

  get(id: string): SignalSnapshot | undefined {
    return this.signals.get(id);
  }

  upsert(snapshot: SignalSnapshot): void {
    this.signals.set(snapshot.id, normalizeSignalSnapshot(snapshot));
    this.pruneIfNeeded();
    this.notifyMutation(true);
  }

  upsertMany(snapshots: SignalSnapshot[]): void {
    for (const s of snapshots) {
      this.signals.set(s.id, normalizeSignalSnapshot(s));
    }
    this.pruneIfNeeded();
    this.notifyMutation(true);
  }

  /** Suppress revision + persist storms during bulk hydration replay. */
  beginBulkImport(): void {
    this.bulkImportDepth++;
  }

  endBulkImport(): void {
    this.bulkImportDepth = Math.max(0, this.bulkImportDepth - 1);
    if (this.bulkImportDepth === 0) {
      if (this.bulkPersistPending) {
        this.bulkPersistPending = false;
        this.persist();
      }
      if (this.bulkRevisionPending) {
        this.bulkRevisionPending = false;
        this.revisionSubject.next(this.revisionSubject.value + 1);
      }
    }
  }

  isBulkImporting(): boolean {
    return this.bulkImportDepth > 0;
  }

  updateEvaluation(id: string, evaluation: SignalSnapshot['evaluation']): void {
    const existing = this.signals.get(id);
    if (!existing) return;
    this.signals.set(id, { ...existing, evaluation });
    this.notifyMutation(true);
  }

  query(filter: SignalIntelligenceFilter = {}): SignalSnapshot[] {
    return this.all().filter(s => this.matches(s, filter));
  }

  count(filter: SignalIntelligenceFilter = {}): number {
    return this.query(filter).length;
  }

  hasDuplicate(symbol: string, signalType: string, timestamp: number, windowMs = 5 * 60_000): boolean {
    const from = timestamp - windowMs;
    const to = timestamp + windowMs;
    return this.all().some(s =>
      s.symbol === symbol
      && s.sourceSignalType === signalType
      && s.timestamp >= from
      && s.timestamp <= to
    );
  }

  clear(): void {
    this.signals.clear();
    this.persist();
    this.revisionSubject.next(this.revisionSubject.value + 1);
  }

  exportPayload(): { version: 1; signals: SignalSnapshot[]; exportedAt: number } {
    return {
      version: 1,
      signals: this.all(),
      exportedAt: Date.now()
    };
  }

  importPayload(payload: { signals?: SignalSnapshot[] }): number {
    const incoming = payload.signals ?? [];
    let added = 0;
    for (const s of incoming) {
      if (!s?.id || this.signals.has(s.id)) continue;
      this.signals.set(s.id, normalizeSignalSnapshot(s));
      added++;
    }
    this.pruneIfNeeded();
    this.persist();
    this.revisionSubject.next(this.revisionSubject.value + 1);
    return added;
  }

  /** Merge server snapshots — server wins when newer or more evaluated. Cache-only localStorage follows. */
  mergeFromServer(snapshots: SignalSnapshot[]): number {
    let merged = 0;
    this.beginBulkImport();
    for (const s of snapshots) {
      if (!s?.id) continue;
      const existing = this.signals.get(s.id);
      const serverBetter = !existing
        || (s.evaluation?.evaluated && !existing.evaluation?.evaluated)
        || s.timestamp >= existing.timestamp;
      if (serverBetter) {
        this.signals.set(s.id, normalizeSignalSnapshot(s));
        merged++;
      }
    }
    this.pruneIfNeeded();
    this.endBulkImport();
    this.persist();
    if (merged > 0 && this.bulkImportDepth === 0) {
      this.revisionSubject.next(this.revisionSubject.value + 1);
    }
    return merged;
  }

  private notifyMutation(persist: boolean): void {
    if (this.bulkImportDepth > 0) {
      if (persist) this.bulkPersistPending = true;
      this.bulkRevisionPending = true;
      return;
    }
    if (persist) this.persist();
    this.revisionSubject.next(this.revisionSubject.value + 1);
  }

  private matches(s: SignalSnapshot, f: SignalIntelligenceFilter): boolean {
    if (f.symbol && s.symbol !== f.symbol) return false;
    if (f.regime && s.marketRegime !== f.regime) return false;
    if (f.signalType && s.signalType !== f.signalType) return false;
    if (f.timeframe && s.timeframe !== f.timeframe) return false;
    if (f.captureStage && s.captureStage !== f.captureStage) return false;
    if (f.fromTs != null && s.timestamp < f.fromTs) return false;
    if (f.toTs != null && s.timestamp > f.toTs) return false;
    if (f.status && s.evaluation?.status !== f.status) return false;
    return true;
  }

  private pruneIfNeeded(): void {
    if (this.signals.size <= MAX_STORED_SIGNALS) return;
    const sorted = this.all();
    const toRemove = sorted.slice(MAX_STORED_SIGNALS);
    for (const s of toRemove) {
      this.signals.delete(s.id);
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(SIGNAL_INTELLIGENCE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { signals?: SignalSnapshot[] };
      for (const s of parsed.signals ?? []) {
        if (s?.id) this.signals.set(s.id, normalizeSignalSnapshot(s));
      }
    } catch {
      // Corrupt storage — start fresh; never fabricate data.
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(
        SIGNAL_INTELLIGENCE_STORAGE_KEY,
        JSON.stringify({ version: 1, signals: this.all(), savedAt: Date.now() })
      );
    } catch {
      // Quota exceeded — prune harder.
      this.pruneIfNeeded();
    }
  }
}
