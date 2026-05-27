/** Phase 181 — paper execution research (canonical execution modes). */

export type PaperExecutionMode =
  | 'OFF'
  | 'PAPER_RESEARCH'
  | 'PAPER_SELECTIVE'
  | 'LIVE_ASSISTED'
  | 'LIVE_AUTO';

export type IbkrGatewayMode = 'DISCONNECTED' | 'PAPER' | 'LIVE' | 'UNKNOWN';

export type PaperExecutionStatus =
  | 'BLOCKED'
  | 'PENDING'
  | 'SUBMITTED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'REJECTED'
  | 'OPEN'
  | 'CLOSED';

export interface PaperExecutionSafety {
  allowed: boolean;
  reason: string | null;
  gateway: IbkrGatewayMode | null;
}

export interface PaperExecutionStatusDto {
  mode: PaperExecutionMode;
  researchInfrastructureEnabled: boolean;
  gatewayMode: IbkrGatewayMode;
  configuredIbkrPort: number;
  paperPort: number;
  livePort: number;
  ibkrConnected: boolean;
  ibkrReadyForOrders: boolean;
  safety: PaperExecutionSafety;
}

export interface PaperExecutionRecord {
  id: number;
  symbol: string;
  regime: string;
  executionMode: PaperExecutionMode;
  status: PaperExecutionStatus;
  planSource?: string;
  entryPrice?: number;
  fillPrice?: number;
  slippage?: number;
  quantity: number;
  ibkrOrderId?: number;
  orderType?: string;
  submittedAt?: string;
  filledAt?: string;
  closedAt?: string;
  entryLatencyMs?: number;
  mfeR?: number;
  maeR?: number;
  realizedR?: number;
  continuationSurvival?: boolean;
  persistenceDurationSec?: number;
  secondLegCaptured?: boolean;
  postExitContinuationR?: number;
  exitQualityNote?: string;
  convictionScore?: number;
  dominanceScore?: number;
  executionQuality?: number;
  blockedReason?: string;
  exitSuggestion?: string;
  updatedAt?: string;
}

export interface PaperProbeRequest {
  symbol: string;
  regime: string;
  planSource?: string;
  entryPrice?: number;
  convictionScore?: number;
  dominanceScore?: number;
  executionQuality?: number;
}

export interface RegimeStats {
  regime: string;
  count: number;
  closed: number;
  avgRealizedR?: number;
  avgMfeR?: number;
  avgMaeR?: number;
  continuationSurvivalCount: number;
}

export interface ExecutionAnalytics {
  totalProbes: number;
  openCount: number;
  closedCount: number;
  blockedCount: number;
  byRegime: Record<string, RegimeStats>;
  avgSlippage?: number;
  avgRealizedR?: number;
  avgMfeR?: number;
  avgMaeR?: number;
}

export interface ExecutionMonitorSnapshot {
  activeOrders: PaperExecutionRecord[];
  activePositions: PaperExecutionRecord[];
  history: PaperExecutionRecord[];
  analytics: ExecutionAnalytics;
}

export const ACTIVE_PAPER_MODES: PaperExecutionMode[] = ['OFF', 'PAPER_RESEARCH'];

export const PLACEHOLDER_PAPER_MODES: PaperExecutionMode[] = [
  'PAPER_SELECTIVE',
  'LIVE_ASSISTED',
  'LIVE_AUTO'
];
