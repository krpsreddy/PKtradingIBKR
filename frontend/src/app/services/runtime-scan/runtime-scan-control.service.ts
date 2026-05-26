import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  DEFAULT_SCAN_RATE_MS,
  RuntimeScanControlState,
  TIER2_PLAN_MS,
  TIER2_SCANNER_MS
} from './runtime-scan-control.models';
import { isUsMarketOpen, sessionDayKey } from '../../utils/market-session.util';
import { RuntimeScanTelemetryService } from './runtime-scan-telemetry.service';

const STORAGE_KEY = 'pk-runtime-scan-control';

@Injectable({ providedIn: 'root' })
export class RuntimeScanControlService implements OnDestroy {
  private readonly stateSubject = new BehaviorSubject<RuntimeScanControlState>(this.load());
  readonly state$ = this.stateSubject.asObservable();

  private scheduleTimer: ReturnType<typeof setInterval> | null = null;
  private manualSessionKey: string | null = null;
  private degradationLevel = 0;
  private pendingTicks = 0;
  private lastSessionKey = sessionDayKey();

  constructor(
    private zone: NgZone,
    private telemetry: RuntimeScanTelemetryService
  ) {
    this.zone.runOutsideAngular(() => {
      this.scheduleTimer = setInterval(() => this.evaluateAutoSchedule(), 30_000);
    });
    this.evaluateAutoSchedule();
  }

  ngOnDestroy(): void {
    if (this.scheduleTimer) clearInterval(this.scheduleTimer);
  }

  state(): RuntimeScanControlState {
    return this.stateSubject.value;
  }

  isScanningEnabled(): boolean {
    return this.stateSubject.value.enabled;
  }

  /** Effective tier-1 nano interval (ms). */
  tier1IntervalMs(): number {
    const base = this.stateSubject.value.scanRateMs;
    const mult = 1 + this.degradationLevel;
    return Math.min(5_000, Math.round(base * mult));
  }

  tier2ScannerIntervalMs(): number {
    return TIER2_SCANNER_MS * (1 + this.degradationLevel * 0.5);
  }

  tier2PlanIntervalMs(): number {
    return TIER2_PLAN_MS * (1 + this.degradationLevel * 0.5);
  }

  toggleScan(): void {
    const s = this.stateSubject.value;
    const next = !s.enabled;
    if (!next) {
      this.manualSessionKey = sessionDayKey();
      this.patch({ enabled: false, manualPaused: true, startedAt: null });
    } else {
      this.manualSessionKey = null;
      this.patch({
        enabled: true,
        manualPaused: false,
        mode: 'MANUAL',
        startedAt: Date.now()
      });
    }
    this.persist();
  }

  setEnabled(enabled: boolean, mode: RuntimeScanControlState['mode'] = 'MANUAL'): void {
    if (!enabled) {
      this.manualSessionKey = sessionDayKey();
      this.patch({ enabled: false, manualPaused: true, mode, startedAt: null });
    } else {
      this.manualSessionKey = null;
      this.patch({ enabled: true, manualPaused: false, mode, startedAt: Date.now() });
    }
    this.persist();
  }

  recordTickStart(): void {
    this.pendingTicks++;
    this.telemetry.setQueueDepth(this.pendingTicks);
  }

  recordTickEnd(durationMs: number, tier: 1 | 2, symbolCount: number): void {
    this.pendingTicks = Math.max(0, this.pendingTicks - 1);
    this.telemetry.setQueueDepth(this.pendingTicks);
    const freq = tier === 1 ? this.tier1IntervalMs() : this.tier2ScannerIntervalMs();
    if (tier === 1) {
      this.telemetry.recordTier1(durationMs, symbolCount, freq, this.degradationLevel > 0);
    } else {
      this.telemetry.recordTier2(durationMs, symbolCount, freq, this.degradationLevel > 0);
    }
    if (durationMs > 250 || this.pendingTicks > 2) {
      this.degradationLevel = Math.min(2, this.degradationLevel + 1);
      this.patch({ cpuProtectionActive: true, degraded: true });
    } else if (this.degradationLevel > 0 && durationMs < 120 && this.pendingTicks === 0) {
      this.degradationLevel = Math.max(0, this.degradationLevel - 1);
      this.patch({
        cpuProtectionActive: this.degradationLevel > 0,
        degraded: this.degradationLevel > 0
      });
    }
    this.patch({ lastTick: Date.now() });
  }

  statusLabel(): { text: string; tone: 'active' | 'paused' | 'degraded' } {
    const s = this.stateSubject.value;
    if (!s.enabled) return { text: 'SCANNING OFF', tone: 'paused' };
    if (s.degraded || s.cpuProtectionActive) return { text: 'SCAN DEGRADED', tone: 'degraded' };
    return { text: 'SCANNING ON', tone: 'active' };
  }

  private evaluateAutoSchedule(): void {
    const day = sessionDayKey();
    if (day !== this.lastSessionKey) {
      this.lastSessionKey = day;
      this.manualSessionKey = null;
    }

    const s = this.stateSubject.value;
    if (s.mode !== 'AUTO' && s.manualPaused) return;

    const marketOpen = isUsMarketOpen();
    const manualBlock = this.manualSessionKey === day;

    if (marketOpen && !manualBlock && !s.enabled) {
      this.patch({
        enabled: true,
        mode: 'AUTO',
        manualPaused: false,
        startedAt: Date.now()
      });
      this.persist();
      return;
    }

    if (!marketOpen && s.mode === 'AUTO' && s.enabled) {
      this.patch({ enabled: false, startedAt: null });
      this.persist();
    }
  }

  private patch(partial: Partial<RuntimeScanControlState>): void {
    const next = { ...this.stateSubject.value, ...partial };
    this.stateSubject.next(next);
  }

  private load(): RuntimeScanControlState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<RuntimeScanControlState>;
        return {
          enabled: !!parsed.enabled,
          mode: parsed.mode === 'MANUAL' ? 'MANUAL' : 'AUTO',
          manualPaused: !!parsed.manualPaused,
          startedAt: parsed.startedAt ?? null,
          lastTick: parsed.lastTick ?? null,
          scanRateMs: parsed.scanRateMs ?? DEFAULT_SCAN_RATE_MS,
          cpuProtectionActive: false,
          degraded: false
        };
      }
    } catch { /* ignore */ }
    const open = isUsMarketOpen();
    return {
      enabled: open,
      mode: 'AUTO',
      manualPaused: !open,
      startedAt: open ? Date.now() : null,
      lastTick: null,
      scanRateMs: DEFAULT_SCAN_RATE_MS,
      cpuProtectionActive: false,
      degraded: false
    };
  }

  private persist(): void {
    try {
      const s = this.stateSubject.value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        enabled: s.enabled,
        mode: s.mode,
        manualPaused: s.manualPaused,
        startedAt: s.startedAt,
        lastTick: s.lastTick,
        scanRateMs: s.scanRateMs
      }));
    } catch { /* ignore */ }
  }
}
