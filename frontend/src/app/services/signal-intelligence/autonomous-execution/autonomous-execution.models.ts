import { LiveExecutionDecision } from '../live-decision/live-decision.models';
import { ExecutionFrameworkMode } from '../execution-mode.service';
import { ContinuationParticipationSignalType } from '../continuation-participation/continuation-participation.models';
import { ClusterFamilyOverlay } from '../../cluster-family-intelligence/cluster-family.models';

export type AutonomousEntryType =
  | 'CONTINUATION_ADD'
  | 'VWAP_ACCEPTANCE_CONTINUATION'
  | 'SHALLOW_PULLBACK_CONTINUATION'
  | 'EARLY_EXPANSION_ENTRY'
  | 'PERSISTENCE_ENTRY'
  | 'HIGH_RVOL_CONTINUATION'
  | 'STRUCTURE_ACCELERATION_ENTRY';

export type AutonomousConfidenceTier = 'INSUFFICIENT' | 'LOW' | 'MODERATE' | 'HIGH';

export interface AutonomousExecutionInput {
  symbol: string;
  signalType?: string;
  sessionTimeMinutes?: number;
  rvol?: number;
  vwapDistance?: number;
  trendAlignment?: number;
  extended?: boolean;
  convictionScore?: number;
  volatility?: number;
  sampleCount?: number;
}

export interface AutonomousExecutionOverlay {
  active: boolean;
  entryType: AutonomousEntryType | null;
  autonomousEntryScore: number;
  clusterSimilarity: number;
  matchedCluster: string | null;
  /** Phase 171 — internal cluster id; never show in trader compact line. */
  matchedClusterId?: string | null;
  clusterFamily?: ClusterFamilyOverlay | null;
  originalDecision: LiveExecutionDecision;
  promotedDecision: LiveExecutionDecision;
  promotionReason: string;
  suppressionRegretRecovery: number | null;
  statsBacked: boolean;
  expectedR: number | null;
  exhaustionBlocked: boolean;
  advisoryOnly: true;
}

export interface LegacyComparisonSnapshot {
  decision: LiveExecutionDecision;
  decisionLabel: string;
  compactLine: string;
}

export interface AutonomousExecutionReport {
  advisoryOnly: true;
  lookbackDays: number;
  generatedAt: number;
  executionMode: ExecutionFrameworkMode;
  sampleCount: number;
  autonomousEntries: { entryType: AutonomousEntryType; count: number; winRate: number; avgR: number }[];
  suppressionRegretRecoveries: { count: number; avgRecoveredR: number };
  expansionCaptureImprovement: { autonomousAvgR: number; legacyAvgR: number; deltaR: number };
  legacyComparison: {
    expansionCapturePct: number;
    fakeoutIncreasePct: number;
    missedContinuationReduction: number;
    entryTimingEfficiency: number;
  };
  topClusterMatches: { cluster: string; count: number; avgR: number }[];
  summaryInsights: string[];
}

export interface AutonomousLiveDecisionExtension {
  autonomousExecution?: AutonomousExecutionOverlay;
  legacyDecision?: LegacyComparisonSnapshot;
  executionFrameworkMode?: ExecutionFrameworkMode;
}
