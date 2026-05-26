import { LiveExecutionDecision } from '../live-decision/live-decision.models';

export type OpeningExpansionClassification =
  | 'INSTITUTIONAL_EXPANSION'
  | 'RETAIL_EXHAUSTION'
  | 'CONTROLLED_DIGESTION'
  | 'NEUTRAL_OPENING';

export type OpeningParticipationMode =
  | 'PROBING_OPEN'
  | 'OPENING_DRIVE_FULL'
  | 'FIRST_PULLBACK_ADD'
  | 'NONE';

export type OpeningExpansionEntryType =
  | 'OPENING_DRIVE_BUY'
  | 'EARLY_EXPANSION_BUY'
  | 'INSTITUTIONAL_IMBALANCE_BUY'
  | 'TREND_DAY_INITIATION'
  | 'FIRST_PULLBACK_BUY'
  | 'OPENING_ACCEPTANCE_BUY';

export type ConfidenceTier = 'INSUFFICIENT' | 'LOW' | 'MODERATE' | 'HIGH';

export interface OpeningExpansionInput {
  symbol: string;
  signalType: string;
  sessionTimeMinutes?: number;
  rvol?: number;
  vwapDistance?: number;
  trendAlignment?: number;
  extended?: boolean;
  score?: number;
  marketRegime?: string;
  sampleCount?: number;
}

export interface OpeningExpansionOverlay {
  active: boolean;
  classification: OpeningExpansionClassification;
  participationMode: OpeningParticipationMode;
  entryType: OpeningExpansionEntryType | null;
  originalDecision: LiveExecutionDecision;
  promotedDecision: LiveExecutionDecision;
  promotionReason: string;
  persistencePct: number | null;
  followThroughPct: number | null;
  statsBacked: boolean;
  expectedR: number | null;
  advisoryOnly: true;
}

export interface OpeningExpansionQualification {
  score: number;
  institutional: boolean;
  retailExhaustion: boolean;
  gapContinuation: boolean;
  orbAcceptance: boolean;
  volumeAcceleration: boolean;
  breadthAligned: boolean;
  noImmediateRejection: boolean;
  followThroughProb: number;
}

export interface OpeningExpansionArchetype {
  label: string;
  count: number;
  winRate: number;
  avgR: number;
  continuationPct: number;
  fakeoutPct: number;
  promotable: boolean;
}

export interface OpeningExpansionCaseStudy {
  id: string;
  label: string;
  symbol: string;
  entryZone: [number, number];
  targetZone: [number, number];
  earliestParticipation: string;
  firstFiveMinQualification: string;
  firstPullbackAddZone: string;
  trendPersistenceSignals: string[];
  governanceSuppressionCause: string;
  idealEntryType: OpeningExpansionEntryType;
}

export interface OpeningExpansionReport {
  advisoryOnly: true;
  lookbackDays: number;
  generatedAt: number;
  sampleCount: number;
  institutionalExpansionDays: OpeningExpansionArchetype[];
  retailExhaustionDays: OpeningExpansionArchetype[];
  earlyParticipationCandidates: {
    symbol: string;
    sessionDate: string;
    signalType: string;
    originalDecision: LiveExecutionDecision;
    entryType: OpeningExpansionEntryType;
    outcomeR: number;
    mode: OpeningParticipationMode;
  }[];
  missedOpeningWinners: {
    symbol: string;
    sessionDate: string;
    waitDecision: string;
    outcomeR: number;
    wouldEntry: OpeningExpansionEntryType;
  }[];
  firstPullbackAdds: OpeningExpansionArchetype[];
  trendDayPersistence: { label: string; count: number; avgR: number; persistencePct: number }[];
  caseStudies: OpeningExpansionCaseStudy[];
  summaryInsights: string[];
}
