import { environment } from '../../../environments/environment';

/** Set from ResearchModeService at app bootstrap (Phase 192). */
let liveRuntimeEnabled: () => boolean = () => true;

export function bindLiveRuntimeEnabled(fn: () => boolean): void {
  liveRuntimeEnabled = fn;
}

function liveRuntime(): boolean {
  return liveRuntimeEnabled();
}

/** Priority tiers for dashboard heartbeat tasks. */
export type DashboardTaskId =
  | 'nanoPulse'
  | 'executionFeed'
  | 'activeSymbol'
  | 'activeSignals'
  | 'systemLight'
  | 'scanner'
  | 'executionPlanRefresh'
  | 'marketHeartbeat'
  | 'aiExecution'
  | 'symbolContext'
  | 'analyticsHeavy';

export type DashboardPriority = 'high' | 'medium' | 'low' | 'background';

export interface DashboardTaskConfig {
  id: DashboardTaskId;
  priority: DashboardPriority;
  /** Base interval when tab visible and dashboard active. */
  intervalMs: number;
  /** Interval when tab hidden. */
  hiddenIntervalMs: number;
  /** Skip when false. */
  enabled?: () => boolean;
  /** Phase 178 — tier label for diagnostics. */
  tier?: 1 | 2 | 3;
}

const hiddenMultiplier = 4;

/** Scan-gated tasks resolved at runtime via RuntimeScanControlService. */
let scanEnabled: () => boolean = () => true;

export function bindScanEnabled(fn: () => boolean): void {
  scanEnabled = fn;
}

export const DASHBOARD_TASKS: DashboardTaskConfig[] = [
  {
    id: 'nanoPulse',
    priority: 'high',
    tier: 1,
    intervalMs: 1_000,
    hiddenIntervalMs: 5_000,
    enabled: () => liveRuntime() && scanEnabled()
  },
  {
    id: 'executionFeed',
    priority: 'high',
    tier: 1,
    intervalMs: environment.feedPollMs ?? 2_000,
    hiddenIntervalMs: (environment.feedPollMs ?? 2_000) * hiddenMultiplier,
    enabled: () => liveRuntime() && scanEnabled()
  },
  {
    id: 'activeSymbol',
    priority: 'high',
    tier: 3,
    intervalMs: 10_000,
    hiddenIntervalMs: 60_000,
    enabled: () => liveRuntime()
  },
  {
    id: 'activeSignals',
    priority: 'high',
    tier: 2,
    intervalMs: 5_000,
    hiddenIntervalMs: 30_000,
    enabled: () => liveRuntime() && scanEnabled()
  },
  {
    id: 'scanner',
    priority: 'medium',
    tier: 2,
    intervalMs: 20_000,
    hiddenIntervalMs: 120_000,
    enabled: () => liveRuntime() && scanEnabled()
  },
  {
    id: 'executionPlanRefresh',
    priority: 'medium',
    tier: 2,
    intervalMs: 12_000,
    hiddenIntervalMs: 60_000,
    enabled: () => liveRuntime() && scanEnabled()
  },
  {
    id: 'systemLight',
    priority: 'medium',
    tier: 2,
    intervalMs: environment.dashboardPollMs ?? 15_000,
    hiddenIntervalMs: (environment.dashboardPollMs ?? 15_000) * hiddenMultiplier,
    enabled: () => liveRuntime()
  },
  {
    id: 'marketHeartbeat',
    priority: 'medium',
    tier: 2,
    intervalMs: 12_000,
    hiddenIntervalMs: 60_000,
    enabled: () => liveRuntime() && scanEnabled()
  },
  {
    id: 'aiExecution',
    priority: 'low',
    tier: 3,
    intervalMs: 15_000,
    hiddenIntervalMs: 90_000,
    enabled: () => liveRuntime() && scanEnabled()
  },
  {
    id: 'symbolContext',
    priority: 'medium',
    tier: 3,
    intervalMs: 15_000,
    hiddenIntervalMs: 60_000,
    enabled: () => liveRuntime()
  },
  {
    id: 'analyticsHeavy',
    priority: 'background',
    tier: 3,
    intervalMs: environment.dashboardHeavyPollMs ?? 60_000,
    hiddenIntervalMs: (environment.dashboardHeavyPollMs ?? 60_000) * 2
  }
];
