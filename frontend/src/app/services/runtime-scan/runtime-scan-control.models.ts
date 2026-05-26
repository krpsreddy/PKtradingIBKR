/** Phase 178 — runtime scan controller state. */
export type ScanControlMode = 'AUTO' | 'MANUAL';

export interface RuntimeScanControlState {
  enabled: boolean;
  mode: ScanControlMode;
  /** User explicitly paused until next session boundary. */
  manualPaused: boolean;
  startedAt: number | null;
  lastTick: number | null;
  scanRateMs: number;
  cpuProtectionActive: boolean;
  degraded: boolean;
}

export interface ScannerRuntimeStats {
  activeSymbols: number;
  tickDurationMs: number;
  queueDepth: number;
  avgLatencyMs: number;
  uiDroppedFrames: number;
  scanFrequencyMs: number;
  degraded: boolean;
  tier1Ticks: number;
  tier2Ticks: number;
}

export const DEFAULT_SCAN_RATE_MS = 1_000;
export const TIER2_SCANNER_MS = 20_000;
export const TIER2_PLAN_MS = 12_000;
