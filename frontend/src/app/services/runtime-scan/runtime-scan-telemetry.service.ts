import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ScannerRuntimeStats } from './runtime-scan-control.models';

/** Phase 178 — dev-only runtime telemetry (console + optional subject). */
@Injectable({ providedIn: 'root' })
export class RuntimeScanTelemetryService {
  private readonly statsSubject = new BehaviorSubject<ScannerRuntimeStats>(this.empty());
  readonly stats$ = this.statsSubject.asObservable();

  private tickSamples: number[] = [];
  private tier1 = 0;
  private tier2 = 0;
  private queueDepth = 0;
  private logEvery = 0;

  recordTier1(durationMs: number, symbolCount: number, frequencyMs: number, degraded: boolean): void {
    this.tier1++;
    this.pushSample(durationMs);
    this.emit(symbolCount, frequencyMs, degraded);
  }

  recordTier2(durationMs: number, symbolCount: number, frequencyMs: number, degraded: boolean): void {
    this.tier2++;
    this.pushSample(durationMs);
    this.emit(symbolCount, frequencyMs, degraded);
  }

  setQueueDepth(depth: number): void {
    this.queueDepth = depth;
    this.statsSubject.next({ ...this.statsSubject.value, queueDepth: depth });
  }

  logSnapshot(): void {
    if (!this.shouldLog()) return;
    console.debug('[ScannerRuntime]', { ...this.statsSubject.value });
  }

  private pushSample(ms: number): void {
    this.tickSamples.push(ms);
    if (this.tickSamples.length > 20) this.tickSamples.shift();
  }

  private emit(symbolCount: number, frequencyMs: number, degraded: boolean): void {
    const avg = this.tickSamples.length
      ? Math.round(this.tickSamples.reduce((a, b) => a + b, 0) / this.tickSamples.length)
      : 0;
    this.statsSubject.next({
      activeSymbols: symbolCount,
      tickDurationMs: this.tickSamples[this.tickSamples.length - 1] ?? 0,
      queueDepth: this.queueDepth,
      avgLatencyMs: avg,
      uiDroppedFrames: 0,
      scanFrequencyMs: frequencyMs,
      degraded,
      tier1Ticks: this.tier1,
      tier2Ticks: this.tier2
    });
    this.logEvery++;
    if (this.logEvery % 30 === 0) this.logSnapshot();
  }

  private shouldLog(): boolean {
    try {
      return localStorage.getItem('pk-scan-debug') === '1' || !((window as unknown as { __PROD__?: boolean }).__PROD__);
    } catch {
      return true;
    }
  }

  private empty(): ScannerRuntimeStats {
    return {
      activeSymbols: 0,
      tickDurationMs: 0,
      queueDepth: 0,
      avgLatencyMs: 0,
      uiDroppedFrames: 0,
      scanFrequencyMs: 1_000,
      degraded: false,
      tier1Ticks: 0,
      tier2Ticks: 0
    };
  }
}
