import {
  IntelligenceSignalType,
  MarketRegime
} from '../../../models/signal-intelligence.model';
import { ConditionCluster } from '../edge-discovery/edge-discovery.models';

/** Phase 137 — live execution gating models (advisory only). */

export type LiveExecutionGateState =
  | 'EDGE_ACTIVE'
  | 'SELECTIVE'
  | 'REDUCE_SIZE'
  | 'NO_EDGE'
  | 'TOXIC';

export type OpenType =
  | 'TREND_OPEN'
  | 'GAP_AND_GO'
  | 'OPENING_FLUSH'
  | 'FAILED_OPEN'
  | 'INSIDE_OPEN'
  | 'MEAN_REVERSION_OPEN'
  | 'RECLAIM_OPEN'
  | 'EXPANSION_OPEN'
  | 'TRAP_OPEN';

export type ContinuationQualityLevel =
  | 'VERY_STRONG'
  | 'STRONG'
  | 'MODERATE'
  | 'WEAK'
  | 'FAILING';

export type LiveFakeoutRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';

export type PremarketExtensionBucket = '0–2%' | '2–5%' | '5–8%' | '8%+';

export type MatrixConditionStatus =
  | 'GOOD'
  | 'ALIGNED'
  | 'FAVORABLE'
  | 'NEUTRAL'
  | 'WEAK'
  | 'UNFAVORABLE'
  | 'HIGH'
  | 'STRONG'
  | 'LOW'
  | 'POOR';

export type CapitalFocusStatus = 'FOCUS' | 'ACTIVE' | 'REDUCE' | 'AVOID';

export interface LiveExecutionContext {
  symbol: string;
  signalType?: string | null;
  marketRegime?: string | null;
  regimeAligned?: boolean;
  rvol?: number | null;
  vwapDistance?: number | null;
  trendAlignment?: number | null;
  sessionTimeMinutes?: number | null;
  volatility?: number | null;
  premarketExtensionPct?: number | null;
  entryQuality?: string | null;
}

export interface SuppressionRule {
  id: string;
  label: string;
  reason: string;
  severity: 'SUPPRESS' | 'REDUCE' | 'WAIT';
}

export interface OpenTypeSnapshot {
  openType: OpenType;
  label: string;
  confidence: number;
  reclaimEnvironment: boolean;
  fakeBreakoutEnvironment: boolean;
}

export interface OpenTypeAnalyticsCell {
  setup: IntelligenceSignalType;
  openType: OpenType;
  sampleCount: number;
  expectancyR: number;
  winRate: number;
  tone: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'INSUFFICIENT';
}

export interface PremarketExtensionSnapshot {
  bucket: PremarketExtensionBucket;
  extensionPct: number;
  continuationExpectancy: number;
  reclaimExpectancy: number;
  fakeoutProbability: number;
  openFailureRate: number;
  trapFrequency: number;
  label: string;
}

export interface ContinuationQualitySnapshot {
  level: ContinuationQualityLevel;
  label: string;
  persistence: number;
  secondLegProbability: number;
  pullbackDepth: number;
  momentumSustainability: number;
  reclaimStability: number;
}

export interface EdgeTodayInsight {
  setup: import('../../autonomous-regime-scanner/autonomous-regime-scanner.models').AutonomousOpportunityType;
  tone: 'WORKING' | 'FAILING' | 'WEAK' | 'STRONG';
  message: string;
  expectancyR: number;
  sampleCount: number;
}

export interface EdgeTodaySnapshot {
  insights: EdgeTodayInsight[];
  headline: string;
  reclaimsWorking: boolean;
  momentumFailing: boolean;
  breakoutsWeak: boolean;
  continuationStrongAfter10: boolean;
  openingFakeoutsElevated: boolean;
}

export interface LiveCapitalAllocationRow {
  symbol: string;
  todayEdge: number;
  status: CapitalFocusStatus;
  historicalEdge: number;
}

export interface ExecutionPlaybookSnapshot {
  bestPlaybook: string;
  avoidPlaybook: string;
  waitFor: string;
  summary: string;
}

export interface LiveExecutionMatrixRow {
  condition: string;
  status: MatrixConditionStatus;
  detail: string;
}

export interface LiveExecutionGateSnapshot {
  state: LiveExecutionGateState;
  label: string;
  headline: string;
  sublines: string[];
  executionScore: number;
  sizeMultiplier: number;
  suppressions: SuppressionRule[];
  openType: OpenTypeSnapshot;
  premarket: PremarketExtensionSnapshot;
  continuation: ContinuationQualitySnapshot;
  fakeoutRisk: LiveFakeoutRiskLevel;
  fakeoutLabel: string;
  edgeToday: EdgeTodaySnapshot;
  capitalRank: LiveCapitalAllocationRow | null;
  capitalRows: LiveCapitalAllocationRow[];
  playbook: ExecutionPlaybookSnapshot;
  matrix: LiveExecutionMatrixRow[];
  matchedCluster: ConditionCluster | null;
  reasons: string[];
  governance: ConfidenceWeightedSuppression;
  executionQuality: ExecutionQualitySnapshot;
  playbookPriorities: DailyPlaybookPrioritySnapshot;
  coachSummary: string;
  advisoryOnly: true;
}

/** Phase 138 — confidence-weighted execution governance. */

export type ConfidenceWeightedState =
  | 'ALLOW'
  | 'SELECTIVE'
  | 'REDUCE_SIZE'
  | 'SUPPRESS'
  | 'TOXIC';

export type StatisticalConfidenceBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface ConfidenceWeightedSuppression {
  state: ConfidenceWeightedState;
  confidence: StatisticalConfidenceBand;
  sizeMultiplier: number;
  reasoning: string[];
  statisticalConfidence: number;
  edgeStability: number;
  advisoryOnly: true;
}

export type EntryTimingQuality = 'EARLY' | 'IDEAL' | 'LATE' | 'CHASE';

export type ChaseRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ExecutionQualitySnapshot {
  entryQualityScore: number;
  executionDiscipline: number;
  chaseRisk: ChaseRiskLevel;
  entryTiming: EntryTimingQuality;
  exitEfficiency: number;
  managementQuality: number;
  signalVsExecution: 'SIGNAL_ISSUE' | 'EXECUTION_ISSUE' | 'MIXED' | 'UNKNOWN';
  labels: string[];
  advisoryOnly: true;
}

export type PlaybookRecommendedSize = 'FULL' | 'REDUCED' | 'SMALL' | 'AVOID';

export interface DailyPlaybookPriority {
  rank: number;
  playbook: string;
  confidence: number;
  expectancy: number;
  reasoning: string[];
  recommendedSize: PlaybookRecommendedSize;
}

export interface DailyPlaybookPrioritySnapshot {
  preferred: DailyPlaybookPriority[];
  avoid: DailyPlaybookPriority[];
  advisoryOnly: true;
}
