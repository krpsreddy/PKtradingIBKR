import { LiveExecutionDecision } from '../live-decision/live-decision.models';

export type ConfidenceTier = 'INSUFFICIENT' | 'LOW' | 'MODERATE' | 'HIGH';

export type ContinuationClassification =
  | 'HEALTHY_CONTINUATION'
  | 'INSTITUTIONAL_RECLAIM'
  | 'CONTROLLED_PULLBACK'
  | 'SECOND_LEG_ACCEPTANCE'
  | 'TREND_DIGESTION'
  | 'TRUE_EXHAUSTION'
  | 'FAILED_CONTINUATION'
  | 'LATE_EXTENSION';

export type ContinuationEntryType =
  | 'CONTINUATION_BUY'
  | 'VWAP_RECLAIM_BUY'
  | 'SECOND_LEG_BUY'
  | 'DIGESTION_BREAKOUT'
  | 'TREND_ACCEPTANCE_BUY'
  | 'PULLBACK_HOLD_ENTRY'
  | 'ADD_ON_RECLAIM';

export interface ContinuationArchetypeStats {
  archetype: string;
  entryLocation: string;
  continuationLevel: string;
  count: number;
  winRate: number;
  avgR: number;
  continuationPct: number;
  fakeoutPct: number;
  confidence: ConfidenceTier;
  promotable: boolean;
}

export interface ContinuationPromotionOverlay {
  active: boolean;
  classification: ContinuationClassification;
  continuationEntryType: ContinuationEntryType | null;
  originalDecision: LiveExecutionDecision;
  promotedDecision: LiveExecutionDecision;
  promotionReason: string;
  suppressionOverride: string;
  statsBacked: boolean;
  expectedR: number | null;
  continuationPct: number | null;
  narrativeQuality: string;
  advisoryOnly: true;
}

export interface PromotedContinuationProfile {
  profile: string;
  classification: ContinuationClassification;
  entryType: ContinuationEntryType;
  count: number;
  winRate: number;
  avgR: number;
  confidence: ConfidenceTier;
  promotionReason: string;
}

export interface HealthyContinuationStat {
  label: string;
  classification: ContinuationClassification;
  count: number;
  winRate: number;
  avgR: number;
  confidence: ConfidenceTier;
}

export interface ContinuationVsExhaustionRow {
  label: string;
  classification: ContinuationClassification;
  count: number;
  avgR: number;
  winRate: number;
  promotable: boolean;
}

export interface PromotionCandidate {
  symbol: string;
  sessionDate: string;
  originalDecision: LiveExecutionDecision;
  promotedDecision: LiveExecutionDecision;
  entryType: ContinuationEntryType;
  classification: ContinuationClassification;
  outcomeR: number;
  reason: string;
}

export interface GovernancePenaltyFailure {
  penalty: string;
  count: number;
  avgMissedR: number;
  confidence: ConfidenceTier;
}

export interface ReclassifiedWinner {
  symbol: string;
  sessionDate: string;
  fromClassification: string;
  toClassification: ContinuationClassification;
  outcomeR: number;
  originalDecision: LiveExecutionDecision;
  promotedDecision: LiveExecutionDecision;
}

export interface InstitutionalReclaimStat {
  profile: string;
  count: number;
  winRate: number;
  avgR: number;
  confidence: ConfidenceTier;
}

export interface TrendDigestionWinner {
  symbol: string;
  sessionDate: string;
  outcomeR: number;
  classification: ContinuationClassification;
  entryType: ContinuationEntryType;
}

export interface ContinuationPromotionReport {
  advisoryOnly: true;
  lookbackDays: number;
  generatedAt: number;
  sampleCount: number;
  promotedContinuationProfiles: PromotedContinuationProfile[];
  healthyContinuationStats: HealthyContinuationStat[];
  continuationVsExhaustion: ContinuationVsExhaustionRow[];
  promotionCandidates: PromotionCandidate[];
  governancePenaltyFailures: GovernancePenaltyFailure[];
  reclassifiedWinners: ReclassifiedWinner[];
  trendPersistenceAnalytics: HealthyContinuationStat[];
  institutionalReclaimStats: InstitutionalReclaimStat[];
  trendDigestionWinners: TrendDigestionWinner[];
  eliteArchetypes: ContinuationArchetypeStats[];
  summaryInsights: string[];
}

export interface ContinuationPromotionInput {
  symbol: string;
  signalType?: string;
  marketRegime?: string;
  rvol?: number;
  trendAlignment?: number;
  vwapDistance?: number;
  sessionTimeMinutes?: number;
  extended?: boolean;
  sequencingState?: string;
  continuationAcceptance?: string;
  pullbackStability?: string;
  fakeoutRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  sampleCount?: number;
}
