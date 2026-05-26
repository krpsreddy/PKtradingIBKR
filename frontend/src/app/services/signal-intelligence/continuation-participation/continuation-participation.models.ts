import { LiveExecutionDecision } from '../live-decision/live-decision.models';

export type ParticipationConfidenceTier = 'INSUFFICIENT' | 'LOW' | 'MODERATE' | 'HIGH';

export type ContinuationParticipationSignalType =
  | 'CONTINUATION_ADD'
  | 'EARLY_EXPANSION_ENTRY'
  | 'VWAP_ACCEPTANCE_CONTINUATION'
  | 'SHALLOW_PULLBACK_CONTINUATION'
  | 'HIGH_RVOL_CONTINUATION'
  | 'PERSISTENCE_ENTRY';

export interface ContinuationParticipationInput {
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

export interface ContinuationParticipationOverlay {
  active: boolean;
  signalType: ContinuationParticipationSignalType | null;
  participationScore: number;
  originalDecision: LiveExecutionDecision;
  promotedDecision: LiveExecutionDecision;
  promotionReason: string;
  matchedArchetype: string | null;
  archetypeSimilarity: number;
  suppressionRegretR: number | null;
  statsBacked: boolean;
  expectedR: number | null;
  exhaustionBlocked: boolean;
  advisoryOnly: true;
}

export interface SuppressionRecoveryRow {
  symbol: string;
  sessionDate: string;
  wasDecision: LiveExecutionDecision;
  participationSignal: ContinuationParticipationSignalType;
  recoveredR: number;
}

export interface ContinuationParticipationReport {
  advisoryOnly: true;
  lookbackDays: number;
  generatedAt: number;
  sampleCount: number;
  participationSignals: {
    signalType: ContinuationParticipationSignalType;
    count: number;
    winRate: number;
    avgR: number;
    fakeoutPct: number;
    continuationPct: number;
    confidence: ParticipationConfidenceTier;
  }[];
  suppressionRecoveries: SuppressionRecoveryRow[];
  continuationAdds: { count: number; avgR: number; winRate: number };
  vwapAcceptanceContinuations: { count: number; avgR: number; winRate: number };
  participationExpectancy: number;
  governanceRelaxationCases: {
    strategyName: string;
    suppressedPct: number;
    avgMissedR: number;
    sampleCount: number;
  }[];
  expansionCaptureImprovement: {
    baselineMissedR: number;
    recoveredR: number;
    improvementPct: number;
  };
  summaryInsights: string[];
}
