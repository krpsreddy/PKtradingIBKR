import {
  ExplainableRegimeExplanation,
  FeatureContribution,
  NumericThresholdCheck,
  ReplayExplainTimelineEvent,
  StrategyExplainableSpec
} from '../explainable-regime.models';

/** Phase 207 — bearish downside semantics (not inverted bullish). */
export type BearishRegimeType =
  | 'FAILED_RECLAIM'
  | 'VWAP_REJECTION'
  | 'DISTRIBUTION_BREAKDOWN'
  | 'BREAKDOWN_CONTINUATION'
  | 'ACCELERATED_SELLING'
  | 'PANIC_EXPANSION'
  | 'EXHAUSTION_REVERSAL'
  | 'WEAK_RECLAIM_FAILURE';

export type SqueezeRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type BearishPutEntryGrade =
  | 'IDEAL_BREAKDOWN'
  | 'FAILED_RECLAIM'
  | 'LATE_FLUSH'
  | 'PANIC_CHASE'
  | 'WEAK_REJECTION'
  | 'SQUEEZE_RISK';

export interface BearishRegimeInput {
  symbol: string;
  sessionTimeMinutes: number;
  rvol: number;
  vwapDistance: number;
  rejectionPersistence: number;
  reclaimFailureScore: number;
  breakdownAcceleration: number;
  weakBounceScore: number;
  distributionScore: number;
  marketWeakness: number;
  sectorWeakness: number;
  lowerHighStructure: boolean;
  exhaustionFlush: boolean;
}

export interface BearishRegimeMetrics {
  breakdownSurvivalScore: number;
  rejectionPersistenceScore: number;
  collapseAccelerationScore: number;
  downsideRvolScore: number;
  squeezeRiskScore: number;
  squeezeRiskLevel: SqueezeRiskLevel;
  putFollowThroughScore: number;
  structureScore: number;
  breakdownProbability: number;
}

export interface BearishLifecycleStep {
  phase: string;
  reason: string;
}

export interface ExplainableBearishExplanation extends ExplainableRegimeExplanation {
  direction: 'BEARISH';
  bearishRegimeType: BearishRegimeType;
  squeezeRiskLevel: SqueezeRiskLevel;
  squeezeRiskScore: number;
  putEntryGrade: BearishPutEntryGrade;
  structureBreakdown: FeatureContribution[];
  lifecyclePath: BearishLifecycleStep[];
  whyBreakdownLikely: string[];
  whySqueezeDangerous: string[];
  breakdownProbability: number;
}

export interface BearishStrategyExplainableSpec extends StrategyExplainableSpec {
  bearishRegimeType: BearishRegimeType;
  squeezeContributors: string[];
}

export type { NumericThresholdCheck, ReplayExplainTimelineEvent, FeatureContribution };
