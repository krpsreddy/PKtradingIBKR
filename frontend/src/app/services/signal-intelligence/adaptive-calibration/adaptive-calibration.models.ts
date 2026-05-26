import { ConfidenceRating } from '../../../models/signal-intelligence.model';
import { ConvictionBand, LiveExecutionDecision } from '../live-decision/live-decision.models';
import { NarrativeTrajectory } from '../market-state/market-state.models';

/** Phase 148 — adaptive calibration intelligence (advisory only). */

export type CalibrationReliability = 'OVERSTATED' | 'UNDERSTATED' | 'ALIGNED' | 'INSUFFICIENT';

export type SuppressionSafety = 'SAFE' | 'UNSAFE' | 'MARGINAL' | 'INSUFFICIENT';

export type WaitAggressiveness = 'TOO_PATIENT' | 'BALANCED' | 'TOO_AGGRESSIVE' | 'INSUFFICIENT';

export type GovernanceBalance = 'TOO_CONSERVATIVE' | 'BALANCED' | 'TOO_AGGRESSIVE';

export interface ConvictionCalibrationRow {
  band: ConvictionBand;
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  expectedR: number;
  actualR: number;
  continuationRate: number;
  fakeoutRate: number;
  regretRate: number;
  reliability: CalibrationReliability;
  confidence: ConfidenceRating;
}

export interface ConvictionCalibrationReport {
  rows: ConvictionCalibrationRow[];
  baselineExpectancyR: number;
  advisoryOnly: true;
}

export interface WaitCalibrationRow {
  waitType: LiveExecutionDecision | 'WAIT_FOR_SECOND_LEG' | 'WAIT_FOR_RECLAIM_HOLD';
  label: string;
  sampleCount: number;
  fakeoutReductionPct: number;
  continuationImprovementPct: number;
  missedExpansionPct: number;
  expectancyDeltaR: number;
  aggressiveness: WaitAggressiveness;
  confidence: ConfidenceRating;
}

export interface WaitCalibrationReport {
  rows: WaitCalibrationRow[];
  optimalAggressiveness: WaitAggressiveness;
  summary: string;
  advisoryOnly: true;
}

export interface SuppressionCalibrationRow {
  zone: string;
  decision: LiveExecutionDecision;
  sampleCount: number;
  falseAvoidRate: number;
  missedWinnerRate: number;
  safeSuppressionRate: number;
  safety: SuppressionSafety;
  confidence: ConfidenceRating;
}

export interface SuppressionCalibrationReport {
  rows: SuppressionCalibrationRow[];
  overSuppressionScore: number;
  advisoryOnly: true;
}

export interface NarrativeConfidenceRow {
  trajectory: NarrativeTrajectory;
  sampleCount: number;
  stabilityScore: number;
  expectancyR: number;
  continuationRate: number;
  aggressionAllowed: boolean;
  confidence: ConfidenceRating;
}

export interface NarrativeConfidenceReport {
  rows: NarrativeConfidenceRow[];
  unstableNarrativeRate: number;
  advisoryOnly: true;
}

export interface ExpansionCaptureRow {
  style: 'AGGRESSIVE' | 'PATIENT' | 'SECOND_LEG_ACCEPTANCE';
  label: string;
  sampleCount: number;
  capturePct: number;
  fakeoutRate: number;
  continuationSurvival: number;
  expectancyR: number;
  confidence: ConfidenceRating;
}

export interface ExpansionCaptureReport {
  rows: ExpansionCaptureRow[];
  bestCaptureStyle: ExpansionCaptureRow['style'] | null;
  advisoryOnly: true;
}

export interface GovernanceBalanceReport {
  balance: GovernanceBalance;
  safetyScore: number;
  expansionScore: number;
  falseAvoidRate: number;
  fakeoutAvoidedRate: number;
  missedExpansionRate: number;
  targetNote: string;
  advisoryOnly: true;
}

export interface CalibrationRegretReport {
  regretScore: number;
  missedExpansion: number;
  falseAvoids: number;
  overconfidence: number;
  underconfidence: number;
  excessiveWaiting: number;
  lowRegretZone: boolean;
  confidence: ConfidenceRating;
  advisoryOnly: true;
}

export interface PlaybookCalibrationProfile {
  playbookKey: string;
  label: string;
  aggressionAllowed: boolean;
  convictionAdjustment: 'DOWNGRADE' | 'UPGRADE' | 'NEUTRAL';
  waitBias: 'PATIENT' | 'BALANCED' | 'AGGRESSIVE';
  note: string;
  confidence: ConfidenceRating;
}

export interface AdaptiveCalibrationObservation {
  id: string;
  headline: string;
  detail: string;
  confidence: ConfidenceRating;
}

export interface AdaptiveCalibrationReport {
  lookbackDays: number;
  totalEvaluated: number;
  conviction: ConvictionCalibrationReport;
  wait: WaitCalibrationReport;
  suppression: SuppressionCalibrationReport;
  narrative: NarrativeConfidenceReport;
  expansion: ExpansionCaptureReport;
  governance: GovernanceBalanceReport;
  regret: CalibrationRegretReport;
  playbookProfiles: PlaybookCalibrationProfile[];
  observations: AdaptiveCalibrationObservation[];
  synthesis: { id: string; headline: string; detail: string }[];
  advisoryOnly: true;
}

export interface LiveAdaptiveCalibrationInput {
  symbol: string;
  signalType?: string;
  marketRegime?: string;
  trendAlignment?: number;
  narrativeTrajectory?: NarrativeTrajectory;
  narrativeQuality?: number;
  sampleCount?: number;
}

export interface LiveAdaptiveCalibrationIntel {
  guidanceLine: string | null;
  compactLine: string | null;
  calibratedConvictionBias: CalibrationReliability | null;
  waitJustified: boolean;
  governanceTooConservative: boolean;
  narrativeStable: boolean;
  regretScore: number;
  lowRegretZone: boolean;
  expansionCaptureHint: string | null;
  detailLines: string[];
  authoritative: boolean;
  advisoryOnly: true;
}

export interface TradeCalibrationMetrics {
  convictionAccuracy: string;
  waitEfficiency: string;
  expansionCapturedPct: number;
  suppressionRegret: string;
}
