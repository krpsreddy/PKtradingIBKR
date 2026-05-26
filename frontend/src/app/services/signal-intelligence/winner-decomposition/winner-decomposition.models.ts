import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { LiveExecutionDecision } from '../live-decision/live-decision.models';

export type ConfidenceTier = 'INSUFFICIENT' | 'LOW' | 'MODERATE' | 'HIGH';

export type EntryLocationType =
  | 'RECLAIM'
  | 'PULLBACK_STABILIZATION'
  | 'SECOND_LEG'
  | 'OPENING_DRIVE'
  | 'BREAKOUT_HOLD'
  | 'VWAP_RECLAIM'
  | 'POST_ACCEPTANCE_CONTINUATION'
  | 'UNKNOWN';

export interface MarketStructureSnapshot {
  higherLows: boolean;
  compression: boolean;
  trendAligned: boolean;
  reclaimAfterFlush: boolean;
  acceptanceAboveVwap: boolean;
  orbHold: boolean;
}

export interface IndicatorSnapshot {
  rvol: number;
  rvolBucket: string;
  emaStack: boolean;
  trendAlignment: number;
  vwapDistance: number;
  vwapDistanceBucket: string;
  sessionMinutes: number;
  sessionWindow: string;
  extendedEntry: boolean;
}

export interface NarrativeSnapshot {
  path: string;
  trajectory: string;
  stability: number;
  continuationAcceptance: string;
  pullbackStability: string;
  fakeoutRisk: string;
}

export interface GovernanceSnapshot {
  decision: LiveExecutionDecision;
  reason: string;
  convictionBand: string;
  suppressedWinner: boolean;
  wouldFullExecution: boolean;
  suppressionReasons: string[];
}

/** Conditions captured at signal fire time — predictive pre-entry state. */
export interface PreEntryEnvironment {
  signalId: string;
  symbol: string;
  sessionDate: string;
  timestamp: number;
  entryLocation: EntryLocationType;
  marketStructure: MarketStructureSnapshot;
  indicators: IndicatorSnapshot;
  narrative: NarrativeSnapshot;
  governance: GovernanceSnapshot;
}

export interface ExpansionWinner {
  signal: SignalSnapshot;
  preEntry: PreEntryEnvironment;
  moveSizeR: number;
  continuationPct: number;
  narrative: string;
  resultBucket: 'GT_3R' | 'GT_2R' | 'WINNER';
  expansionEfficiency: number;
  bestEntryPrice: number;
  sessionMovePct: number;
}

export interface MissedWinner {
  symbol: string;
  sessionDate: string;
  timestamp: number;
  decision: LiveExecutionDecision;
  suppressionReason: string;
  outcomeR: number;
  whatHappenedAfter: string;
  shouldHaveBeen: string;
  entryLocation: EntryLocationType;
  narrative: string;
  convictionBand: string;
}

export interface ExpansionNarrativeProfile {
  narrative: string;
  count: number;
  avgR: number;
  winRate: number;
  continuationPct: number;
  confidence: ConfidenceTier;
  exampleSymbols: string[];
}

export interface SuppressedWinnerPattern {
  pattern: string;
  count: number;
  avgMissedR: number;
  topDecisions: string[];
  confidence: ConfidenceTier;
  examples: string[];
}

export interface EliteEntryCondition {
  profile: string;
  entryLocation: EntryLocationType;
  preconditions: string[];
  count: number;
  avgR: number;
  winRate: number;
  continuationPct: number;
  confidence: ConfidenceTier;
}

export interface GovernanceFailure {
  failureType: string;
  count: number;
  avgMissedR: number;
  description: string;
  confidence: ConfidenceTier;
}

export interface ContinuationAcceptanceProfile {
  profile: string;
  count: number;
  avgR: number;
  avgContinuationPct: number;
  preconditions: string[];
  confidence: ConfidenceTier;
}

export interface RecommendedEntryProfile {
  profile: string;
  entryLocation: EntryLocationType;
  triggerConditions: string[];
  avgR: number;
  sampleCount: number;
  confidence: ConfidenceTier;
}

export interface FalseAvoidPattern {
  pattern: string;
  count: number;
  avgMissedR: number;
  confidence: ConfidenceTier;
}

export interface TrendPersistenceAnalytic {
  label: string;
  count: number;
  avgR: number;
  continuationRate: number;
  confidence: ConfidenceTier;
}

export interface ExpansionConditionMatrixRow {
  rvolBucket: string;
  breadthBucket: string;
  narrativeStability: string;
  pullbackDepth: string;
  continuationProbability: number;
  avgR: number;
  count: number;
  confidence: ConfidenceTier;
}

export interface AmdCaseStudyDecomposition {
  id: string;
  label: string;
  symbol: string;
  sessionDate: string | null;
  matched: boolean;
  moveDescription: string;
  earliestInstitutionalEntry: PreEntryEnvironment | null;
  idealReclaim: PreEntryEnvironment | null;
  secondLegTrigger: PreEntryEnvironment | null;
  governanceSuppressionCause: string;
  shouldHaveBeenFullExecution: string;
  missedWinners: MissedWinner[];
  expansionWinners: ExpansionWinner[];
}

export interface WinnerDecompositionReport {
  advisoryOnly: true;
  lookbackDays: number;
  generatedAt: number;
  sampleCount: number;
  largeWinnerCount: number;
  topExpansionNarratives: ExpansionNarrativeProfile[];
  suppressedWinnerPatterns: SuppressedWinnerPattern[];
  eliteEntryConditions: EliteEntryCondition[];
  governanceFailures: GovernanceFailure[];
  continuationAcceptanceProfiles: ContinuationAcceptanceProfile[];
  recommendedEntryProfiles: RecommendedEntryProfile[];
  falseAvoidPatterns: FalseAvoidPattern[];
  trendPersistenceAnalytics: TrendPersistenceAnalytic[];
  expansionConditionMatrix: ExpansionConditionMatrixRow[];
  biggestWinners: ExpansionWinner[];
  missedWinners: MissedWinner[];
  amdCaseStudies: AmdCaseStudyDecomposition[];
  summaryInsights: string[];
}
