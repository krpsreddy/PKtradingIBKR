import { ConfidenceRating, MarketRegime, SignalSnapshot } from '../../../models/signal-intelligence.model';

/** Phase 141 — execution quality classification (analytics only). */

export type ExecutionEntryClassification =
  | 'IDEAL'
  | 'ACCEPTABLE'
  | 'RECLAIM_CONFIRMED'
  | 'EARLY_PROBE'
  | 'EXTENDED'
  | 'CHASE'
  | 'EXHAUSTED'
  | 'TRAP_RISK'
  | 'LIQUIDITY_SWEEP_RISK';

export type ChaseSubClassification = 'GOOD_CHASE' | 'BAD_CHASE' | 'NEUTRAL_CHASE';

export type SuppressionSafetyRating = 'SAFE' | 'CAUTION' | 'RISKY' | 'INSUFFICIENT_DATA';

export interface ExecutionQualityFeatureScores {
  extensionPct: number;
  vwapAligned: boolean;
  breadthStrong: boolean;
  continuationStrong: boolean;
  pullbackStable: boolean;
  reclaimHeld: boolean;
  fakeoutElevated: boolean;
  momentumAccelerating: boolean;
  expansionLeg: number;
  lateRelativeToImpulse: boolean;
}

export interface EntryClassificationResult {
  classification: ExecutionEntryClassification;
  confidence: ConfidenceRating;
  authoritative: boolean;
  scores: ExecutionQualityFeatureScores;
  rationale: string[];
  advisoryOnly: true;
}

export interface ClassificationExpectancyRow {
  classification: ExecutionEntryClassification;
  setup: string;
  regime: MarketRegime | 'ALL';
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  fakeoutRate: number;
  continuationSuccess: number;
  avgMfeR: number;
  avgMaeR: number;
  hit1RRate: number;
  hit2RRate: number;
  confidence: ConfidenceRating;
}

export interface ClassificationExpectancySummary {
  byClassification: Omit<ClassificationExpectancyRow, 'setup' | 'regime'>[];
  matrix: ClassificationExpectancyRow[];
  lookbackDays: number;
  totalEvaluated: number;
  advisoryOnly: true;
}

export interface GoodVsBadChasePanel {
  subType: ChaseSubClassification;
  sampleCount: number;
  expectancyR: number;
  winRate: number;
  fakeoutRate: number;
  continuationSuccess: number;
  exhaustionRate: number;
  bestConditions: string[];
  advisoryOnly: true;
}

export interface GoodVsBadChaseReport {
  good: GoodVsBadChasePanel;
  bad: GoodVsBadChasePanel;
  neutral: GoodVsBadChasePanel;
  advisoryOnly: true;
}

export interface ReclaimTimingBucket {
  window: string;
  sampleCount: number;
  holdRate: number;
  continuationRate: number;
  fakeoutRate: number;
  expectancyR: number;
}

export interface ReclaimExtensionBucket {
  bucket: string;
  sampleCount: number;
  holdRate: number;
  expectancyR: number;
}

export interface ReclaimQualityReport {
  sampleCount: number;
  holdRate: number;
  continuationRate: number;
  fakeoutRate: number;
  rejectionRate: number;
  expectancyR: number;
  timingBuckets: ReclaimTimingBucket[];
  extensionBuckets: ReclaimExtensionBucket[];
  failurePatterns: string[];
  bySetupRegime: { key: string; sampleCount: number; expectancyR: number; holdRate: number }[];
  advisoryOnly: true;
}

export interface ExecutionMissedWinnerRow {
  classification: ExecutionEntryClassification;
  suppressedCount: number;
  missedWinners: number;
  missedExpectancyR: number;
  missedContinuationPct: number;
  regretScore: number;
  safetyRating: SuppressionSafetyRating;
  note: string;
}

export interface ExecutionMissedWinnerReport {
  rows: ExecutionMissedWinnerRow[];
  totalRegretScore: number;
  overSuppressionSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
  advisoryOnly: true;
}

export interface ExecutionQualitySynthesisLine {
  id: string;
  headline: string;
  detail: string;
  confidence: ConfidenceRating;
}

export interface ExecutionQualityReport {
  lookbackDays: number;
  totalEvaluated: number;
  generatedAt: number;
  expectancy: ClassificationExpectancySummary;
  matrix: ClassificationExpectancyRow[];
  goodVsBadChase: GoodVsBadChaseReport;
  reclaimQuality: ReclaimQualityReport;
  missedWinners: ExecutionMissedWinnerReport;
  synthesis: ExecutionQualitySynthesisLine[];
  advisoryOnly: true;
}

export interface LiveExecutionQualityIntel {
  classification: ExecutionEntryClassification;
  chaseSubType: ChaseSubClassification | null;
  compactLine: string;
  detailLines: string[];
  fakeoutRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  continuationLabel: string;
  governanceHint: string;
  authoritative: boolean;
  advisoryOnly: true;
}

export interface LiveExecutionQualityInput {
  symbol: string;
  signalType?: string;
  marketRegime?: string;
  rvol?: number;
  trendAlignment?: number;
  vwapDistance?: number;
  sessionTimeMinutes?: number;
  extended?: boolean;
  entryQuality?: string | null;
  captureStage?: SignalSnapshot['captureStage'];
}
