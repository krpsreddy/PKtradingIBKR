import { LiveExecutionDecision } from '../signal-intelligence/live-decision/live-decision.models';
import { LiveRegimeMetrics } from '../live-regime-intelligence/live-regime.models';

/** Precise tactical entry trigger types. */
export type ExecutionTriggerEntryType =
  | 'DIRECT_CONTINUATION_ENTRY'
  | 'SHALLOW_PULLBACK_ENTRY'
  | 'VWAP_PERSISTENCE_ENTRY'
  | 'MICRO_COMPRESSION_BREAKOUT'
  | 'ORB_CONTINUATION_ADD'
  | 'ACCELERATION_RECLAIM'
  | 'TREND_RESUMPTION_ENTRY';

/** Trader-facing actionable labels. */
export type TraderExecutionAction =
  | 'EARLY_CONTINUATION_ENTRY'
  | 'HEALTHY_SHALLOW_PULLBACK'
  | 'ADD_ON_COMPRESSION_BREAKOUT'
  | 'VWAP_HOLD_CONTINUATION'
  | 'TREND_RESUMPTION_READY'
  | 'LATE_STAGE_EXHAUSTION'
  | 'DO_NOT_CHASE';

export type ChartTriggerZone =
  | 'CONTINUATION_ENTRY'
  | 'SHALLOW_PULLBACK_HOLD'
  | 'COMPRESSION_BREAKOUT'
  | 'VWAP_PERSISTENCE'
  | 'EXTENSION_WARNING'
  | 'EXHAUSTION_DEVELOPING';

export type RiskLevel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';

export interface ExecutionTriggerMetrics {
  continuationIntegrity: number;
  pullbackEfficiency: number;
  compressionEnergy: number;
  extensionHealth: number;
  continuationVelocity: number;
  institutionalPressure: number;
  exhaustionDrift: number;
}

export interface ExecutionTriggerInput {
  symbol: string;
  signalType?: string;
  marketRegime?: string;
  sessionTimeMinutes?: number;
  rvol?: number;
  vwapDistance?: number;
  trendAlignment?: number;
  extended?: boolean;
  structureScore?: number;
  volatility?: number;
  pullbackDepth?: number;
  price?: number;
  vwap?: number;
  sampleCount?: number;
  regimeMetrics?: LiveRegimeMetrics;
}

export interface IdealEntryZone {
  low: number;
  high: number;
  label: string;
}

export interface ExecutionTriggerOverlay {
  active: boolean;
  entryType: ExecutionTriggerEntryType | null;
  traderAction: TraderExecutionAction;
  metrics: ExecutionTriggerMetrics;
  triggerScore: number;
  triggerReason: string;
  idealEntryZone: IdealEntryZone | null;
  continuationRisk: RiskLevel;
  chartZone: ChartTriggerZone;
  vwapPersistenceMinutes: number;
  expansionProbability: number;
  originalDecision: LiveExecutionDecision;
  promotedDecision: LiveExecutionDecision;
  addOpportunity: boolean;
  advisoryOnly: true;
}

export interface ExecutionCard {
  symbol: string;
  action: TraderExecutionAction;
  entryType: ExecutionTriggerEntryType | null;
  continuationIntegrity: RiskLevel;
  rvolLabel: string;
  shallowPbQuality: string;
  vwapPersistenceLabel: string;
  expansionProbability: number;
  idealEntryZone: IdealEntryZone | null;
  continuationRisk: RiskLevel;
  triggerReason: string;
  windowLabel: string;
}

export interface TriggerMomentRow {
  symbol: string;
  sessionDate: string;
  timestamp: number;
  entryType: ExecutionTriggerEntryType;
  traderAction: TraderExecutionAction;
  triggerScore: number;
  triggerReason: string;
  whyValid: string;
  addOpportunity: boolean;
}

export interface ExecutionTriggerReport {
  advisoryOnly: true;
  lookbackDays: number;
  generatedAt: number;
  sampleCount: number;
  activeTriggers: TriggerMomentRow[];
  shallowPullbackEntries: TriggerMomentRow[];
  compressionBreakouts: TriggerMomentRow[];
  vwapPersistenceEntries: TriggerMomentRow[];
  addOpportunities: TriggerMomentRow[];
  exhaustionMoments: TriggerMomentRow[];
  executionCards: ExecutionCard[];
  summaryInsights: string[];
}
