import { ConfidenceRating } from '../../../models/signal-intelligence.model';

/** Phase 145 — institutional market narrative intelligence (advisory only). */

export type MarketState =
  | 'OPENING_DRIVE'
  | 'EARLY_EXTENSION'
  | 'FAILED_BREAKOUT'
  | 'PULLBACK_STABILIZATION'
  | 'VWAP_RECLAIM'
  | 'ACCEPTANCE'
  | 'SECOND_LEG_CONTINUATION'
  | 'TREND_EXPANSION'
  | 'EXHAUSTION'
  | 'LIQUIDITY_SWEEP'
  | 'FAILED_ACCEPTANCE'
  | 'TRAP_REVERSAL'
  | 'RANGE_COMPRESSION'
  | 'LATE_CHASE_ENVIRONMENT';

export type NarrativeTrajectory =
  | 'NARRATIVE_IMPROVING'
  | 'NARRATIVE_STABLE'
  | 'NARRATIVE_FAILING'
  | 'NARRATIVE_EXHAUSTED';

export type InstitutionalFlowType =
  | 'ACCUMULATION'
  | 'DISTRIBUTION'
  | 'ABSORPTION'
  | 'MOMENTUM_CHASING'
  | 'LIQUIDITY_TRAP'
  | 'TREND_ACCEPTANCE';

export interface MarketStateTransition {
  from: MarketState | null;
  to: MarketState;
  timestamp?: number;
  quality: 'STRONG' | 'MODERATE' | 'WEAK';
}

export interface MarketStatePath {
  states: MarketState[];
  transitions: MarketStateTransition[];
  current: MarketState;
  trajectory: NarrativeTrajectory;
}

export interface NarrativePlaybook {
  id: string;
  label: string;
  states: MarketState[];
  sampleCount: number;
  expectancyR: number;
  continuationRate: number;
  fakeoutRate: number;
  stability: number;
  verdict: 'BEST' | 'DANGEROUS' | 'NEUTRAL';
}

export interface StateTransitionExpectancyRow {
  pathKey: string;
  states: MarketState[];
  sampleCount: number;
  expectancyR: number;
  continuationRate: number;
  fakeoutRate: number;
  sustainability: number;
  survival: number;
  confidence: ConfidenceRating;
}

export interface TransitionFailureInsight {
  id: string;
  label: string;
  sampleCount: number;
  breakPoint: MarketState;
  note: string;
}

export interface NarrativeQualitySnapshot {
  score: number;
  stability: number;
  breadthAlignment: number;
  reclaimQuality: number;
  continuationHealth: number;
  extensionRisk: number;
  confidence: ConfidenceRating;
}

export interface LiveMarketStateInput {
  symbol: string;
  signalType?: string;
  marketRegime?: string;
  sessionTimeMinutes?: number;
  vwapDistance?: number;
  extended?: boolean;
  entryQuality?: string | null;
  trendAlignment?: number;
  rvol?: number;
  sequencingState?: string;
  fakeoutRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  sampleCount?: number;
}

export interface LiveMarketStateIntel {
  currentState: MarketState;
  statePath: MarketState[];
  trajectory: NarrativeTrajectory;
  trajectoryLabel: string;
  narrativeLine: string;
  compactLine: string;
  institutionalFlow: InstitutionalFlowType;
  flowLabel: string;
  narrativeQuality: number;
  detailLines: string[];
  authoritative: boolean;
  advisoryOnly: true;
}

export interface MarketNarrativeReport {
  lookbackDays: number;
  totalEvaluated: number;
  bestNarratives: NarrativePlaybook[];
  dangerousNarratives: NarrativePlaybook[];
  stableNarratives: string[];
  unstableNarratives: string[];
  transitionExpectancy: StateTransitionExpectancyRow[];
  transitionFailures: TransitionFailureInsight[];
  institutionalFlowSummary: { flow: InstitutionalFlowType; sampleCount: number; expectancyR: number }[];
  currentFlowHint: string;
  synthesis: { id: string; headline: string; detail: string }[];
  advisoryOnly: true;
}
