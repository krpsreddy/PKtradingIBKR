import { ConfidenceRating } from '../../../models/signal-intelligence.model';
import {
  ConvictionBand,
  LiveExecutionDecision,
  InstitutionalEntryQuality
} from '../live-decision/live-decision.models';

/** Phase 144 — decision feedback & self-auditing execution intelligence (advisory only). */

export type DecisionReliabilityGroup = 'FULL_EXECUTION' | 'WAIT' | 'REDUCE' | 'AVOID' | 'TRAP_RISK';

export interface DecisionAuditRow {
  signalId: string;
  symbol: string;
  timestamp: number;
  decision: LiveExecutionDecision;
  conviction: ConvictionBand;
  setup: string;
  regime: string;
  breadth: string;
  executionQuality: InstitutionalEntryQuality;
  continuationQuality: string;
  outcome: string;
  expectancyR: number;
  fakeout: boolean;
  mfeR: number;
  maeR: number;
  correct: boolean;
  marketStatePath: string;
}

export interface DecisionAccuracyStat {
  decision: LiveExecutionDecision;
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  fakeoutRate: number;
  accuracyRate: number;
  correctAvoidanceRate?: number;
  confidence: ConfidenceRating;
}

export interface WaitVsActComparison {
  strategy: string;
  strategyId: string;
  sampleCount: number;
  instantExpectancyR: number;
  waitExpectancyR: number;
  expectancyImprovementR: number;
  fakeoutReductionPct: number;
  continuationImprovementPct: number;
  missedWinnerCostR: number;
  confidence: ConfidenceRating;
}

export interface WaitVsActReport {
  baselineExpectancyR: number;
  comparisons: WaitVsActComparison[];
  summary: string;
  advisoryOnly: true;
}

export interface DecisionRegretReport {
  regretScore: number;
  falseAvoids: number;
  falseTrapWarnings: number;
  unnecessarySizeReductions: number;
  excessiveWaiting: number;
  overConservativeZones: { label: string; sampleCount: number; note: string }[];
  advisoryOnly: true;
}

export interface ConvictionCalibrationPoint {
  band: ConvictionBand;
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  calibrationDeltaR: number;
  reliability: 'OVERSTATED' | 'UNDERSTATED' | 'ALIGNED' | 'INSUFFICIENT';
  confidence: ConfidenceRating;
}

export interface ConvictionCalibrationReport {
  points: ConvictionCalibrationPoint[];
  baselineExpectancyR: number;
  advisoryOnly: true;
}

export interface DecisionConsistencyIssue {
  contextKey: string;
  sampleCount: number;
  dominantDecision: LiveExecutionDecision;
  conflictingDecisions: LiveExecutionDecision[];
  instabilityScore: number;
  note: string;
}

export interface DecisionConsistencyReport {
  issues: DecisionConsistencyIssue[];
  unstableEdgeZones: string[];
  noisyClassifications: number;
  advisoryOnly: true;
}

export interface AdaptiveDecisionObservation {
  id: string;
  headline: string;
  detail: string;
  confidence: ConfidenceRating;
}

export interface DecisionReliabilityScore {
  group: DecisionReliabilityGroup;
  label: string;
  score: number;
  sampleCount: number;
  expectancyR: number;
  fakeoutAvoidance: number;
  continuationSurvival: number;
  missedWinnerSeverity: number;
  stability: number;
  consistency: number;
  confidence: ConfidenceRating;
}

export interface EngineConfidenceLine {
  id: string;
  headline: string;
  tone: 'POSITIVE' | 'NEUTRAL' | 'WARNING';
}

export interface EngineConfidenceSnapshot {
  lines: EngineConfidenceLine[];
  performingWell: boolean;
  advisoryOnly: true;
}

export interface LiveDecisionFeedbackIntel {
  adaptiveInsightLine: string | null;
  engineConfidence: EngineConfidenceSnapshot;
  authoritative: boolean;
  advisoryOnly: true;
}

export interface DecisionFeedbackReport {
  lookbackDays: number;
  totalEvaluated: number;
  accuracy: DecisionAccuracyStat[];
  auditedSample: DecisionAuditRow[];
  waitVsAct: WaitVsActReport;
  regret: DecisionRegretReport;
  convictionCalibration: ConvictionCalibrationReport;
  consistency: DecisionConsistencyReport;
  reliabilityScores: DecisionReliabilityScore[];
  observations: AdaptiveDecisionObservation[];
  engineConfidence: EngineConfidenceSnapshot;
  adaptiveInsightLine: string | null;
  synthesis: { id: string; headline: string; detail: string }[];
  advisoryOnly: true;
}
