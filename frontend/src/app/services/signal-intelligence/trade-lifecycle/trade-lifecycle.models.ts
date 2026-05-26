import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { EntryTimingQuality } from '../live-execution/live-execution.models';
import { MarketState } from '../market-state/market-state.models';

/** Phase 140 — trade lifecycle intelligence (analytics + coaching only). */

export type TradeLifecycleState =
  | 'INITIATION'
  | 'ACCEPTANCE'
  | 'EXPANSION'
  | 'EXTENSION'
  | 'EXHAUSTION'
  | 'FAILURE'
  | 'EXIT';

export type ContinuationHealth =
  | 'VERY_STRONG'
  | 'STRONG'
  | 'MODERATE'
  | 'WEAKENING'
  | 'FAILING';

export type FailureAttributionType =
  | 'SIGNAL_FAILURE'
  | 'EXECUTION_FAILURE'
  | 'MANAGEMENT_FAILURE'
  | 'FAKEOUT_FAILURE'
  | 'LATE_ENTRY_FAILURE'
  | 'EXHAUSTION_ENTRY'
  | 'WEAK_BREADTH_FAILURE'
  | 'OPEN_TYPE_FAILURE'
  | 'CONTINUATION_DECAY';

export type ManagementStyle =
  | 'AGGRESSIVE_HOLD'
  | 'FAST_PARTIAL'
  | 'TRAILING_EXIT'
  | 'EARLY_EXIT';

export type AcceptanceOutcome = 'ACCEPTED' | 'REJECTED' | 'MIXED' | 'UNKNOWN';

export interface TradeLifecycleEvent {
  state: TradeLifecycleState;
  timestamp: number;
  label: string;
  metrics?: Record<string, number | string | boolean>;
}

export interface TradeLifecyclePath {
  signalId: string;
  symbol: string;
  signalType: string;
  timestamp: number;
  events: TradeLifecycleEvent[];
  terminalState: TradeLifecycleState;
  acceptance: AcceptanceOutcome;
  continuationHealth: ContinuationHealth;
  entryTiming: EntryTimingQuality;
  realizedR: number;
  mfeR: number;
  maeR: number;
}

export interface LifecycleQualityScores {
  executionQuality: number;
  managementQuality: number;
  exitQuality: number;
}

export interface MarketStateTimelineEvent {
  state: MarketState;
  label: string;
}

export interface TradeLifecycleSnapshot {
  signalId: string;
  symbol: string;
  lifecycleState: TradeLifecycleState;
  continuationHealth: ContinuationHealth;
  executionQuality: number;
  managementQuality: number;
  exitQuality: number;
  failureReason: FailureAttributionType | null;
  attributionConfidence: number;
  lifecycleNotes: string[];
  entryTiming: EntryTimingQuality;
  acceptance: AcceptanceOutcome;
  path: TradeLifecyclePath;
  marketStatePath: MarketStateTimelineEvent[];
  entryLocation: import('../adaptive-entry/adaptive-entry.models').EntryLocationType;
  entryEfficiencyPct: number;
  convictionAccuracy: string;
  waitEfficiency: string;
  suppressionRegret: string;
  advisoryOnly: true;
}

export interface OutcomeAttributionRow {
  signalId: string;
  symbol: string;
  signalType: string;
  outcome: string;
  primaryFailure: FailureAttributionType | null;
  secondaryFailures: FailureAttributionType[];
  entryTiming: EntryTimingQuality;
  signalCorrect: boolean;
  executionFailed: boolean;
  managementFailed: boolean;
  confidence: number;
  summary: string;
}

export interface ExitQualityMetrics {
  exitEfficiency: number;
  gaveBackProfitPct: number;
  unrealizedExpectancyR: number;
  realizedExpectancyR: number;
  reversalAwareness: number;
  trailingQuality: number;
}

export interface ManagementAnalyticsSnapshot {
  prematureExitRate: number;
  heldThroughExhaustionRate: number;
  missedPartialRate: number;
  poorStopDisciplineRate: number;
  addedIntoExtensionRate: number;
  scalingQuality: number;
  exitEfficiency: number;
  labels: string[];
}

export interface ManagementStyleExpectancy {
  style: ManagementStyle;
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  avgMfeR: number;
  avgRealizedR: number;
}

export interface PlaybookLifecycleInsight {
  playbookKey: string;
  label: string;
  sampleCount: number;
  avgContinuationHealth: number;
  sustainScore: number;
  failFastRate: number;
  exhaustEarlyRate: number;
  scalingReward: number;
  chasePenalty: number;
}

export interface LifecycleCoachingInsight {
  headline: string;
  detail: string;
  severity: 'INFO' | 'WARN' | 'POSITIVE';
}

export interface TradeLifecycleIntelligenceSnapshot {
  symbol: string;
  lookbackDays: number;
  totalEvaluated: number;
  /** Latest / active trade lifecycle view for coaching panel. */
  current: TradeLifecycleSnapshot | null;
  trades: TradeLifecycleSnapshot[];
  paths: TradeLifecyclePath[];
  attributions: OutcomeAttributionRow[];
  management: ManagementAnalyticsSnapshot;
  exitQuality: ExitQualityMetrics;
  managementStyles: ManagementStyleExpectancy[];
  playbookInsights: PlaybookLifecycleInsight[];
  coaching: LifecycleCoachingInsight[];
  expectancyByTiming: { timing: EntryTimingQuality; n: number; expectancyR: number }[];
  generatedAt: number;
  advisoryOnly: true;
}

export interface LifecycleCoachSnapshot {
  lifecycleState: TradeLifecycleState;
  continuationHealth: ContinuationHealth;
  executionQuality: number;
  managementQuality: number;
  exitQuality: number;
  failureReason: FailureAttributionType | null;
  attributionConfidence: number;
  coaching: LifecycleCoachingInsight[];
  lifecycleNotes: string[];
  advisoryOnly: true;
}

/** Build input bundle for per-trade analysis. */
export interface TradeLifecycleInput {
  signal: SignalSnapshot;
  symbolHistory?: SignalSnapshot[];
}
