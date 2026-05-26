import { ConfidenceRating } from '../../../models/signal-intelligence.model';
import { ContinuationAcceptanceLevel } from '../entry-sequencing/entry-sequencing.models';
import { PullbackStabilityLevel } from '../entry-sequencing/entry-sequencing.models';
import { EntryAcceptanceState } from '../entry-sequencing/entry-sequencing.models';

/** Phase 143 — live execution decision (advisory only). */

export type LiveExecutionDecision =
  | 'FULL_EXECUTION'
  | 'PROBING_EXECUTION'
  | 'WAIT_FOR_ACCEPTANCE'
  | 'WAIT_FOR_PULLBACK'
  | 'REDUCE_SIZE'
  | 'AVOID_CHASE'
  | 'AVOID_TRADE'
  | 'TRAP_RISK';

export type ConvictionBand = 'ELITE' | 'HIGH' | 'MODERATE' | 'LOW' | 'AVOID';

export type ExecutionTimingDecision =
  | 'NOW'
  | 'WAIT_FOR_HOLD'
  | 'WAIT_FOR_PULLBACK'
  | 'WAIT_FOR_SECOND_LEG'
  | 'TOO_LATE';

export type ContinuationSustainability =
  | 'VERY_HIGH'
  | 'HIGH'
  | 'MODERATE'
  | 'LOW'
  | 'FAILING';

export type ConflictResolution = 'PROCEED' | 'REDUCE' | 'WAIT' | 'AVOID';

export type InstitutionalEntryQuality =
  | 'RETAIL_CHASE'
  | 'EMOTIONAL_EXTENSION'
  | 'EARLY_PROBE'
  | 'INSTITUTIONAL_RECLAIM'
  | 'CONFIRMED_CONTINUATION'
  | 'EXHAUSTED_ENTRY'
  | 'LATE_BREAKOUT'
  | 'SECOND_LEG_ACCEPTANCE';

export interface ExecutionConvictionSnapshot {
  score: number;
  band: ConvictionBand;
  label: string;
  advisoryOnly: true;
}

export interface LiveDecisionContext {
  symbol: string;
  signalType?: string;
  marketRegime?: string;
  rvol?: number;
  trendAlignment?: number;
  vwapDistance?: number;
  sessionTimeMinutes?: number;
  extended?: boolean;
  entryQuality?: string | null;
  signalAgeMinutes?: number | null;
  governanceState?: string;
  governanceConfidence?: number;
  fakeoutRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  continuationLevel?: string;
  sizeMultiplier?: number;
  executionScore?: number;
  sequencingState?: EntryAcceptanceState;
  continuationAcceptance?: ContinuationAcceptanceLevel;
  pullbackStability?: PullbackStabilityLevel;
  sampleCount?: number;
  entryLocationQuality?: import('../adaptive-entry/adaptive-entry.models').EntryLocationType;
  narrativeQuality?: number;
  /** Phase 148 — adaptive calibration overlays (advisory only). */
  calibratedConvictionBias?: 'OVERSTATED' | 'UNDERSTATED' | 'ALIGNED' | 'INSUFFICIENT' | null;
  waitJustified?: boolean;
  governanceTooConservative?: boolean;
  narrativeStable?: boolean;
  calibrationRegretScore?: number;
  lowRegretZone?: boolean;
}

export interface LiveExecutionDecisionSnapshot {
  decision: LiveExecutionDecision;
  decisionLabel: string;
  conviction: ExecutionConvictionSnapshot;
  timing: ExecutionTimingDecision;
  timingLabel: string;
  sustainability: ContinuationSustainability;
  entryQuality: InstitutionalEntryQuality;
  conflictResolution: ConflictResolution;
  keyReason: string;
  riskLabel: string;
  compactLine: string;
  detailLine: string;
  authoritative: boolean;
  advisoryOnly: true;
  /** Phase 155 — statistical continuation promotion overlay. */
  continuationPromotion?: import('../continuation-promotion/continuation-promotion.models').ContinuationPromotionOverlay;
  /** Phase 156 — opening drive early participation overlay. */
  openingExpansion?: import('../opening-expansion/opening-expansion.models').OpeningExpansionOverlay;
  /** Phase 159 — continuation participation overlay. */
  continuationParticipation?: import('../continuation-participation/continuation-participation.models').ContinuationParticipationOverlay;
  /** Phase 160 — autonomous execution overlay. */
  autonomousExecution?: import('../autonomous-execution/autonomous-execution.models').AutonomousExecutionOverlay;
  /** Phase 160 hybrid — legacy decision snapshot for comparison. */
  legacyDecision?: import('../autonomous-execution/autonomous-execution.models').LegacyComparisonSnapshot;
  /** Phase 162 — live regime detection overlay. */
  liveRegime?: import('../../live-regime-intelligence/live-regime.models').LiveRegimeOverlay;
  /** Phase 163 — execution trigger intelligence overlay. */
  executionTrigger?: import('../../execution-trigger-intelligence/execution-trigger.models').ExecutionTriggerOverlay;
  executionFrameworkMode?: import('../execution-mode.service').ExecutionFrameworkMode;
}

export interface DecisionQualityRow {
  decision: LiveExecutionDecision;
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  fakeoutRate: number;
}

export interface ConvictionAccuracyRow {
  band: ConvictionBand;
  sampleCount: number;
  winRate: number;
  expectancyR: number;
}

export interface WaitBenefitRow {
  preset: string;
  expectancyGainR: number;
  fakeoutsAvoided: number;
  winnersMissed: number;
}

export interface OverConfidenceRow {
  label: string;
  sampleCount: number;
  expectancyR: number;
  note: string;
}

export interface DecisionQualityReport {
  lookbackDays: number;
  totalEvaluated: number;
  byDecision: DecisionQualityRow[];
  convictionAccuracy: ConvictionAccuracyRow[];
  waitBenefit: WaitBenefitRow[];
  overConfidence: OverConfidenceRow[];
  decisionAccuracy: {
    losersAvoided: number;
    winnersAllowed: number;
    fakeoutReductionPct: number;
  };
  synthesis: { id: string; headline: string; detail: string }[];
  advisoryOnly: true;
}
