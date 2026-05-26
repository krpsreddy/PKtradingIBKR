import { LiveExecutionDecision } from '../live-decision/live-decision.models';

export type DiscoveryConfidenceTier = 'INSUFFICIENT' | 'LOW' | 'MODERATE' | 'HIGH';

export type DiscoveredStrategyKind =
  | 'EXPANSION_CLUSTER'
  | 'CONTINUATION_PROFILE'
  | 'PERSISTENCE_PATTERN';

export type IdealEntryZoneKind =
  | 'DIRECT_BREAKOUT'
  | 'PULLBACK_ENTRY'
  | 'RECLAIM_ENTRY'
  | 'CONTINUATION_ADD';

/** Numeric pre-expansion vector — no legacy signal-type labels. */
export interface PreExpansionFeatureVector {
  rvolQ: number;
  sessionQ: number;
  vwapDistQ: number;
  trendQ: number;
  volatilityQ: number;
  convictionQ: number;
  extended: 0 | 1;
  captureStage: 0 | 1 | 2;
  regimeCode: number;
  emaAligned: 0 | 1;
  pullbackDepthQ: number;
  volumeAccelQ: number;
  structureScore: number;
}

export interface DiscoveredCondition {
  dimension: string;
  label: string;
  value: string;
}

export interface DiscoveredStrategy {
  id: string;
  name: string;
  kind: DiscoveredStrategyKind;
  conditions: DiscoveredCondition[];
  sampleCount: number;
  winRate: number;
  avgR: number;
  avgDollar: number;
  fakeoutPct: number;
  continuationPct: number;
  confidence: DiscoveryConfidenceTier;
  featureKey: string;
  idealEntryZone: IdealEntryZoneKind;
  promotable: boolean;
  /** Distinct symbols in cluster sample (for discovery table). */
  topSymbols: string[];
  /** Cluster centroid for explainable numeric decomposition (Phase 170). */
  centroid?: PreExpansionFeatureVector;
  breakpoints?: Record<string, number[]>;
}

export interface ExpansionClusterRow {
  clusterId: string;
  name: string;
  kind: DiscoveredStrategyKind;
  sampleCount: number;
  avgR: number;
  avgDollar: number;
  topSymbols: string[];
  confidence: DiscoveryConfidenceTier;
}

export interface HiddenContinuationPattern {
  patternId: string;
  name: string;
  preConditions: DiscoveredCondition[];
  sampleCount: number;
  winRate: number;
  avgR: number;
  continuationPct: number;
  confidence: DiscoveryConfidenceTier;
}

export interface OptimalPullbackStructure {
  id: string;
  pullbackDepthLabel: string;
  compressionLabel: string;
  sampleCount: number;
  winRate: number;
  avgR: number;
  vsChaseDeltaR: number;
  confidence: DiscoveryConfidenceTier;
}

export interface InstitutionalExpansionProfile {
  profileId: string;
  label: string;
  sampleCount: number;
  winRate: number;
  avgR: number;
  avgDollar: number;
  continuationPct: number;
  preExpansionSummary: string[];
  confidence: DiscoveryConfidenceTier;
}

export interface StrategyFeatureImportance {
  dimension: string;
  label: string;
  separationScore: number;
  topClusterMean: number;
  baselineMean: number;
}

export interface GovernanceSuppressedPattern {
  strategyId: string;
  strategyName: string;
  sampleCount: number;
  avgMissedR: number;
  suppressedPct: number;
  topGovernanceDecisions: LiveExecutionDecision[];
  examples: string[];
}

export interface ReplayDiscoveryExample {
  signalId: string;
  symbol: string;
  sessionDate: string;
  timestamp: number;
  strategyId: string;
  strategyName: string;
  outcomeR: number;
  idealEntryZone: IdealEntryZoneKind;
}

export interface PreExpansionConditionReport {
  condition: string;
  presencePct: number;
  avgRWhenPresent: number;
  avgRWhenAbsent: number;
  liftR: number;
  sampleCount: number;
  confidence: DiscoveryConfidenceTier;
}

export interface AutonomousDiscoveryReport {
  advisoryOnly: true;
  lookbackDays: number;
  generatedAt: number;
  totalEvaluated: number;
  eliteWinnerCount: number;
  discoveredStrategies: DiscoveredStrategy[];
  topExpansionClusters: ExpansionClusterRow[];
  hiddenContinuationPatterns: HiddenContinuationPattern[];
  optimalPullbackStructures: OptimalPullbackStructure[];
  institutionalExpansionProfiles: InstitutionalExpansionProfile[];
  strategyFeatureImportance: StrategyFeatureImportance[];
  governanceSuppressedPatterns: GovernanceSuppressedPattern[];
  preExpansionConditions: PreExpansionConditionReport[];
  idealEntryZones: { zone: IdealEntryZoneKind; sampleCount: number; avgR: number; winRate: number }[];
  replayExamples: ReplayDiscoveryExample[];
  summaryInsights: string[];
}
