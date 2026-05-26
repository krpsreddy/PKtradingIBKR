import { LiveExecutionDecision } from '../signal-intelligence/live-decision/live-decision.models';

/** Detected live continuation regime (pre-expansion). */
export type LiveRegimeType =
  | 'EXPLOSIVE_CONTINUATION'
  | 'EARLY_ACCELERATION'
  | 'INSTITUTIONAL_PERSISTENCE'
  | 'SHALLOW_PULLBACK_CONTINUATION'
  | 'VWAP_ACCEPTANCE_PERSISTENCE'
  | 'TREND_COMPRESSION_RELEASE'
  | 'LATE_EXHAUSTION'
  | 'RETAIL_CHASE_EXHAUSTION'
  | 'CHOP_INSTABILITY';

/** Symbol-level live classification. */
export type LiveRegimeClassification =
  | 'EXPLOSIVE_CONTINUATION'
  | 'PERSISTENT_TREND'
  | 'HEALTHY_PULLBACK'
  | 'REACCELERATION_READY'
  | 'EXTENDED_BUT_HEALTHY'
  | 'LATE_STAGE_EXHAUSTION'
  | 'CHOP_UNSTABLE';

export interface LiveRegimeMetrics {
  continuationPersistenceScore: number;
  accelerationIntegrity: number;
  shallowPullbackQuality: number;
  expansionProbability: number;
  institutionalParticipationScore: number;
  exhaustionProbability: number;
  trendPersistenceProbability: number;
}

export interface LiveRegimeInput {
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
  breadthAlignment?: number;
  sectorRelativeStrength?: number;
  continuationQuality?: number;
  sampleCount?: number;
}

export interface LiveRegimeOverlay {
  active: boolean;
  regimeType: LiveRegimeType | null;
  classification: LiveRegimeClassification | null;
  metrics: LiveRegimeMetrics;
  participationOpportunity: boolean;
  originalDecision: LiveExecutionDecision;
  promotedDecision: LiveExecutionDecision;
  promotionReason: string;
  transitionWarning: string | null;
  chartHint: string | null;
  advisoryOnly: true;
}

export interface ActiveRegimeRow {
  symbol: string;
  regimeType: LiveRegimeType;
  classification: LiveRegimeClassification;
  expansionProbability: number;
  continuationPersistenceScore: number;
  sessionTimeMinutes?: number;
}

export interface RegimeTransitionWarning {
  symbol: string;
  fromRegime: LiveRegimeType;
  toRegime: LiveRegimeType;
  warning: string;
  exhaustionProbability: number;
}

export interface ContinuationTimelineRow {
  symbol: string;
  sessionDate: string;
  timestamp: number;
  regimeType: LiveRegimeType;
  classification: LiveRegimeClassification;
  continuationPersistenceScore: number;
}

export interface ParticipationOpportunityRow {
  symbol: string;
  signalType?: string;
  classification: LiveRegimeClassification;
  expansionProbability: number;
  shallowPullbackQuality: number;
  windowLabel: string;
  advisoryNote: string;
}

export interface LiveRegimeReport {
  advisoryOnly: true;
  lookbackDays: number;
  generatedAt: number;
  sampleCount: number;
  activeContinuationRegimes: ActiveRegimeRow[];
  institutionalPersistenceLeaderboard: ActiveRegimeRow[];
  shallowPullbackContinuations: ActiveRegimeRow[];
  expansionProbabilityLeaders: ActiveRegimeRow[];
  exhaustionProbabilityLeaders: ActiveRegimeRow[];
  regimeTransitionWarnings: RegimeTransitionWarning[];
  continuationPersistenceTimeline: ContinuationTimelineRow[];
  participationOpportunities: ParticipationOpportunityRow[];
  summaryInsights: string[];
}
