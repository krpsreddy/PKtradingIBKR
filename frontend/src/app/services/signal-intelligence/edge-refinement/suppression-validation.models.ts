import { ConfidenceRating, SignalSnapshot } from '../../../models/signal-intelligence.model';
import { ExecutionQualityReport } from '../execution-quality/execution-quality.models';
import { EntrySequencingReport } from '../entry-sequencing/entry-sequencing.models';
import { DecisionQualityReport } from '../live-decision/live-decision.models';
import { DecisionFeedbackReport } from '../decision-feedback/decision-feedback.models';
import { MarketNarrativeReport } from '../market-state/market-state.models';
import { AdaptiveEntryReport } from '../adaptive-entry/adaptive-entry.models';

/** Phase 141 — suppression validation & edge refinement (analytics only). */

export type SuppressionRuleCategory = 'TOXIC' | 'ENTRY' | 'ACCEPTANCE' | 'TIMING' | 'COMPOSITE';

export type SuppressionVerdict =
  | 'RECOMMENDED'
  | 'MARGINAL'
  | 'OVER_SUPPRESSED'
  | 'INSUFFICIENT_DATA'
  | 'HARMFUL';

export type SimulationPresetId =
  | 'TOXIC_ENTRIES'
  | 'RECLAIM_CONFIRMATION'
  | 'ANTI_CHASE'
  | 'DELAYED_CONTINUATION';

export interface SuppressionRuleDef {
  id: string;
  label: string;
  category: SuppressionRuleCategory;
  description: string;
  matches: (s: SignalSnapshot) => boolean;
}

export interface SuppressionPerformanceMetrics {
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  avgMfeR: number;
  avgMaeR: number;
  hit1RRate: number;
  hit2RRate: number;
  fakeoutRate: number;
  drawdownR: number;
  continuationQuality: number;
  confidence: ConfidenceRating;
}

export interface SuppressionImprovementDeltas {
  expectancyR: number;
  winRate: number;
  fakeoutRate: number;
  drawdownR: number;
  tradeCount: number;
  tradeCountPct: number;
  hit1RRate: number;
  hit2RRate: number;
  avgMfeR: number;
  avgMaeR: number;
  missedWinners: number;
  missedHighRTrades: number;
  missedExpectancyR: number;
}

export interface SuppressionSimulationResult {
  ruleId: string;
  ruleLabel: string;
  category: SuppressionRuleCategory;
  verdict: SuppressionVerdict;
  qualityScore: number;
  baseline: SuppressionPerformanceMetrics;
  suppressed: SuppressionPerformanceMetrics;
  deltas: SuppressionImprovementDeltas;
  removedCount: number;
  removedWinners: number;
  removedLosers: number;
  overSuppressed: boolean;
  advisoryNote: string;
  advisoryOnly: true;
}

export interface DangerousEntryInsight {
  id: string;
  label: string;
  sampleCount: number;
  expectancyR: number;
  fakeoutRate: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  note: string;
}

export interface AcceptanceConfirmationResult {
  id: string;
  label: string;
  instantExpectancyR: number;
  confirmedExpectancyR: number;
  deltaR: number;
  fakeoutImprovement: number;
  sampleInstant: number;
  sampleConfirmed: number;
}

export interface EntryTimingSimulationRow {
  timing: string;
  sampleCount: number;
  expectancyR: number;
  winRate: number;
  fakeoutRate: number;
  avgMfeR: number;
}

export interface MissedWinnerInsight {
  ruleId: string;
  ruleLabel: string;
  missedCount: number;
  missedExpectancyR: number;
  missedHighRCount: number;
  examples: string[];
}

export interface LiveCandidateFilter {
  id: string;
  headline: string;
  detail: string;
  expectancyDeltaR: number;
  qualityScore: number;
  verdict: SuppressionVerdict;
}

export interface EdgeRefinementReport {
  lookbackDays: number;
  totalEvaluated: number;
  generatedAt: number;
  baseline: SuppressionPerformanceMetrics;
  bestSuppressions: SuppressionSimulationResult[];
  dangerousConditions: DangerousEntryInsight[];
  overSuppressed: SuppressionSimulationResult[];
  acceptanceResults: AcceptanceConfirmationResult[];
  entryTiming: EntryTimingSimulationRow[];
  missedWinners: MissedWinnerInsight[];
  liveCandidates: LiveCandidateFilter[];
  expectedExpectancyImprovementR: number;
  tradeReductionPct: number;
  allSimulations: SuppressionSimulationResult[];
  activePreset: SimulationPresetId | null;
  executionQuality: ExecutionQualityReport | null;
  entrySequencing: EntrySequencingReport | null;
  decisionQuality: DecisionQualityReport | null;
  decisionFeedback: DecisionFeedbackReport | null;
  marketNarrative: MarketNarrativeReport | null;
  adaptiveEntry: AdaptiveEntryReport | null;
  adaptiveCalibration: import('../adaptive-calibration/adaptive-calibration.models').AdaptiveCalibrationReport | null;
  advisoryOnly: true;
}

export interface SimulationPreset {
  id: SimulationPresetId;
  label: string;
  description: string;
  ruleIds: string[];
}
