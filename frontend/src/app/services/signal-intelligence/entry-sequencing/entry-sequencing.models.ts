import { ConfidenceRating, MarketRegime, SignalSnapshot } from '../../../models/signal-intelligence.model';

/** Phase 142 — entry acceptance sequencing (analytics only). */

export type EntryAcceptanceState =
  | 'INITIAL_TRIGGER'
  | 'EARLY_EXTENSION'
  | 'WAITING_FOR_ACCEPTANCE'
  | 'RECLAIM_IN_PROGRESS'
  | 'RECLAIM_CONFIRMED'
  | 'PULLBACK_STABILIZING'
  | 'CONTINUATION_ACCEPTED'
  | 'SECOND_LEG_CONFIRMED'
  | 'OVEREXTENDED'
  | 'EXHAUSTING'
  | 'FAILED_ACCEPTANCE'
  | 'LIQUIDITY_SWEEP'
  | 'REJECTED';

export type PullbackStabilityLevel = 'VERY_STABLE' | 'STABLE' | 'UNSTABLE' | 'FAILING';

export type ContinuationAcceptanceLevel =
  | 'VERY_STRONG_ACCEPTANCE'
  | 'STRONG_ACCEPTANCE'
  | 'NEUTRAL_ACCEPTANCE'
  | 'WEAK_ACCEPTANCE'
  | 'FAILING_ACCEPTANCE';

export interface EntryEvolutionPath {
  signalId: string;
  symbol: string;
  setup: string;
  regime: MarketRegime;
  states: EntryAcceptanceState[];
  finalState: EntryAcceptanceState;
  improved: boolean;
  degraded: boolean;
  outcomeR: number;
  advisoryOnly: true;
}

export interface AcceptanceTransitionStat {
  from: EntryAcceptanceState;
  to: EntryAcceptanceState;
  count: number;
  winRate: number;
  expectancyR: number;
}

export interface ReclaimAcceptanceReport {
  sampleCount: number;
  holdRate: number;
  rejectionRate: number;
  continuationRate: number;
  recoveryRate: number;
  secondLegRate: number;
  fakeoutRate: number;
  exhaustionProbability: number;
  bySetupRegime: { key: string; sampleCount: number; holdRate: number; expectancyR: number }[];
  byBreadth: { bucket: string; sampleCount: number; holdRate: number; expectancyR: number }[];
  byRvol: { bucket: string; sampleCount: number; holdRate: number; expectancyR: number }[];
  failureSignatures: string[];
  advisoryOnly: true;
}

export interface PullbackStabilityReport {
  level: PullbackStabilityLevel;
  sampleCount: number;
  expectancyR: number;
  continuationSurvival: number;
  byLevel: { level: PullbackStabilityLevel; sampleCount: number; expectancyR: number; continuationSurvival: number }[];
  advisoryOnly: true;
}

export interface ContinuationAcceptanceReport {
  level: ContinuationAcceptanceLevel;
  sampleCount: number;
  expectancyR: number;
  fakeoutRate: number;
  byLevel: { level: ContinuationAcceptanceLevel; sampleCount: number; expectancyR: number; fakeoutRate: number }[];
  advisoryOnly: true;
}

export interface SecondLegReport {
  sampleCount: number;
  successRate: number;
  expectancyR: number;
  exhaustionAfterFirstLeg: number;
  bestConditions: string[];
  failedPatterns: string[];
  advisoryOnly: true;
}

export interface SequencingSimulationPreset {
  id: string;
  label: string;
  description: string;
}

export interface SequencingSimulationResult {
  presetId: string;
  presetLabel: string;
  baseline: SequencingMetrics;
  sequenced: SequencingMetrics;
  deltas: SequencingDeltas;
  advisoryNote: string;
  advisoryOnly: true;
}

export interface SequencingMetrics {
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  fakeoutRate: number;
  continuationRate: number;
  avgMfeR: number;
  confidence: ConfidenceRating;
}

export interface SequencingDeltas {
  expectancyR: number;
  winRate: number;
  fakeoutRate: number;
  continuationRate: number;
  missedWinners: number;
  delayedEntryCostR: number;
  rrImprovement: number;
}

export interface SequencingRegretRow {
  presetId: string;
  improvedByWaiting: number;
  worsenedByWaiting: number;
  missedContinuation: number;
  fakeoutsAvoided: number;
  expectancyGained: number;
  bestWindow: string;
}

export interface SequencingRegretReport {
  rows: SequencingRegretRow[];
  advisoryOnly: true;
}

export interface AcceptanceMatrixRow {
  acceptance: ContinuationAcceptanceLevel;
  setup: string;
  regime: MarketRegime | 'ALL';
  sampleCount: number;
  expectancyR: number;
  fakeoutRate: number;
  continuationQuality: number;
  sustainability: number;
  confidence: ConfidenceRating;
}

export interface EntrySequencingSynthesisLine {
  id: string;
  headline: string;
  detail: string;
  confidence: ConfidenceRating;
}

export interface EntrySequencingReport {
  lookbackDays: number;
  totalEvaluated: number;
  generatedAt: number;
  evolutionPaths: EntryEvolutionPath[];
  commonPaths: { path: string; count: number; expectancyR: number }[];
  transitions: AcceptanceTransitionStat[];
  reclaimAcceptance: ReclaimAcceptanceReport;
  pullbackStability: PullbackStabilityReport;
  continuationAcceptance: ContinuationAcceptanceReport;
  secondLeg: SecondLegReport;
  simulations: SequencingSimulationResult[];
  regret: SequencingRegretReport;
  acceptanceMatrix: AcceptanceMatrixRow[];
  synthesis: EntrySequencingSynthesisLine[];
  advisoryOnly: true;
}

export interface LiveEntrySequencingIntel {
  currentState: EntryAcceptanceState;
  compactLine: string;
  detailLines: string[];
  pullbackStability: PullbackStabilityLevel;
  continuationAcceptance: ContinuationAcceptanceLevel;
  fakeoutRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  governanceHint: string;
  authoritative: boolean;
  advisoryOnly: true;
}

export interface LiveEntrySequencingInput {
  symbol: string;
  signalType?: string;
  marketRegime?: string;
  rvol?: number;
  trendAlignment?: number;
  vwapDistance?: number;
  sessionTimeMinutes?: number;
  extended?: boolean;
  entryQuality?: string | null;
}

export interface SequencedSignalContext {
  signal: SignalSnapshot;
  states: EntryAcceptanceState[];
  finalState: EntryAcceptanceState;
  pullback: PullbackStabilityLevel;
  continuation: ContinuationAcceptanceLevel;
}
