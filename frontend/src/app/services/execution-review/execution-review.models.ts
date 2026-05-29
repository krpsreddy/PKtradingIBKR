export interface DailySummary {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  winRate: number;
  realizedPnlR: number | null;
  expectancyR: number | null;
  avgR: number | null;
  continuationCapturePct: number;
  bestRegime: string;
  worstRegime: string;
  queueMissScore: number;
  sessionDate: string;
}

export interface TimelineEvent {
  phase: string;
  timestampMs: number;
  dominance: number | null;
  persistence: number | null;
  velocity: number | null;
  lifecycle: string | null;
  note: string | null;
}

export interface ReplayLaunch {
  signalId: string;
  symbol: string;
  sessionDate: string;
  timestampMs: number;
  replayIndex: number;
}

export interface TradeReview {
  telemetryId: number;
  paperExecutionId: number | null;
  symbol: string;
  regime: string;
  conviction: number;
  dominance: number;
  persistence: number;
  lifecycle: string | null;
  executionQuality: string | null;
  entryQuality: string;
  exitQuality: string;
  mfeR: number | null;
  maeR: number | null;
  realizedR: number | null;
  continuationCapturePct: number;
  holdDurationSec: number | null;
  outcome: string;
  exitReason: string | null;
  sessionPeriod: string | null;
  marketRegime: string | null;
  openedAtMs: number;
  closedAtMs: number | null;
  narrative: string;
  timeline: TimelineEvent[];
  replay: ReplayLaunch;
}

export interface RegimePerformance {
  regime: string;
  tradeCount: number;
  winRate: number;
  expectancyR: number | null;
  avgHoldSec: number | null;
  continuationCapturePct: number;
  persistenceSurvivalPct: number;
  secondLegSuccessPct: number;
  bestSession: string;
}

export interface ContinuationCapture {
  telemetryId: number;
  symbol: string;
  mfeR: number | null;
  realizedR: number | null;
  capturePct: number;
  mfeCapturePct: number;
  secondLegCapturePct: number;
  persistenceMonetizationPct: number;
  trailEfficiencyPct: number;
}

export interface QueueAnalysisItem {
  symbol: string;
  regime: string | null;
  orchestrationState: string;
  reason: string | null;
  activeSymbol: string | null;
  dominance: number;
  conviction: number;
  recordedAtMs: number;
  verdict: string;
  note: string;
  hypotheticalDeltaR: number | null;
}

export interface QueueAnalysis {
  queuedVsActive: QueueAnalysisItem[];
  suppressions: QueueAnalysisItem[];
  replacementAdvisories: QueueAnalysisItem[];
  correctSuppressions: number;
  queueOutperformedActive: number;
}

export interface SessionAnalysis {
  sessionPeriod: string;
  trades: number;
  winRate: number;
  avgR: number | null;
  continuationCapturePct: number;
  marketContext: string;
}

export interface TradeFilters {
  regime?: string | null;
  lifecycle?: string | null;
  outcome?: string | null;
  symbol?: string | null;
  sessionPeriod?: string | null;
  entryQuality?: string | null;
  exitQuality?: string | null;
}

export interface TradesResponse {
  trades: TradeReview[];
  appliedFilters: TradeFilters;
}

export interface ReviewFilters {
  date: string;
  regime: string;
  lifecycle: string;
  outcome: string;
  symbol: string;
  sessionPeriod: string;
  entryQuality: string;
  exitQuality: string;
}
