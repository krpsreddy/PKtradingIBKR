import { ConfidenceRating, MarketRegime } from '../../../models/signal-intelligence.model';
import { AutonomousOpportunityType } from '../../autonomous-regime-scanner/autonomous-regime-scanner.models';

/** Phase 134 — automated edge discovery models (analytics only). */

export type EdgeClassificationState =
  | 'HIGH_EDGE'
  | 'MODERATE_EDGE'
  | 'NEUTRAL'
  | 'WEAK_EDGE'
  | 'NO_EDGE'
  | 'TOXIC';

export type ExecutionEdgeGateState =
  | 'EDGE_ACTIVE'
  | 'SELECTIVE'
  | 'REDUCE_SIZE'
  | 'OBSERVE_ONLY'
  | 'NO_EDGE'
  | 'TOXIC';

export type EdgeScoreBand = 'AGGRESSIVE' | 'FAVORABLE' | 'SELECTIVE' | 'REDUCE_SIZE' | 'NO_EDGE';

export type CapitalRank = 'HIGH' | 'MODERATE' | 'REDUCED' | 'AVOID';

export interface ConditionClusterMetrics {
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  avgMfeR: number;
  avgMaeR: number;
  hit1RRate: number;
  hit2RRate: number;
  fakeoutRate: number;
  avgTimeToFailureMin: number;
  continuationPersistence: number;
  confidence: ConfidenceRating;
}

export interface ConditionCluster {
  id: string;
  label: string;
  setup: AutonomousOpportunityType;
  regime?: MarketRegime;
  rvolBucket?: string;
  timeWindow?: string;
  premarketBucket?: string;
  entryQuality?: string;
  breadthBucket?: string;
  metrics: ConditionClusterMetrics;
  edgeState: EdgeClassificationState;
  edgeScore: number;
  edgeScoreBand: EdgeScoreBand;
}

export interface EdgeDiscoverySnapshot {
  lookbackDays: number;
  totalEvaluated: number;
  clusters: ConditionCluster[];
  highEdge: ConditionCluster[];
  toxic: ConditionCluster[];
  noEdge: ConditionCluster[];
  heatmapRegime: HeatmapCell[];
  heatmapRvol: HeatmapCell[];
  heatmapTime: HeatmapCell[];
  heatmapBreadth: HeatmapCell[];
  computedAt: number;
}

export interface HeatmapCell {
  setup: AutonomousOpportunityType;
  dimension: string;
  sampleCount: number;
  expectancyR: number;
  winRate: number;
  tone: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'INSUFFICIENT';
}

export interface EliminationRecommendation {
  id: string;
  severity: 'SUPPRESS' | 'AVOID' | 'REDUCE' | 'WAIT';
  label: string;
  reason: string;
  clusterId: string;
  expectancyR: number;
  sampleCount: number;
}

export interface EdgeDecaySignal {
  clusterLabel: string;
  earlyExpectancyR: number;
  lateExpectancyR: number;
  decayPct: number;
  fakeoutDelta: number;
  message: string;
}

export interface EdgeDecaySnapshot {
  weakening: EdgeDecaySignal[];
  risingFakeout: EdgeDecaySignal[];
}

export interface SymbolCapitalRank {
  symbol: string;
  edgeScore: number;
  edgeScoreBand: EdgeScoreBand;
  capitalRank: CapitalRank;
  expectancyR: number;
  sampleCount: number;
  fakeoutRate: number;
  stability: number;
}

export interface DailyEdgeDiscoveryReport {
  lookbackDays: number;
  generatedAt: number;
  discovery: EdgeDiscoverySnapshot;
  eliminations: EliminationRecommendation[];
  decay: EdgeDecaySnapshot;
  symbolRankings: SymbolCapitalRank[];
  strongestConditions: ConditionCluster[];
  weakestConditions: ConditionCluster[];
  bestSetups: ConditionCluster[];
  toxicConditions: ConditionCluster[];
  bestSymbols: SymbolCapitalRank[];
  weakeningEdges: EdgeDecaySignal[];
  risingFakeoutEnvironments: EdgeDecaySignal[];
  recommendedSuppressions: EliminationRecommendation[];
  bestTimeWindows: ConditionCluster[];
  aiSummary: EdgeDiscoveryAiSummary;
}

export interface EdgeDiscoveryAiSummary {
  summary: string;
  strongestEdge: string;
  topToxic: string;
  capitalGuidance: string;
  suppressions: string[];
  anomalies: string[];
  provider: string;
  fallbackUsed: boolean;
}

export interface ExecutionEdgeGateResult {
  state: ExecutionEdgeGateState;
  label: string;
  reasons: string[];
  matchedCluster: ConditionCluster | null;
  edgeScore: number;
  advisoryOnly: true;
}

export interface EdgeDiscoveryCompressedPayload {
  lookbackDays: number;
  totalEvaluated: number;
  topEdge: { label: string; exp: number; n: number }[];
  toxic: { label: string; exp: number; n: number }[];
  suppressions: string[];
  symbolRanks: { symbol: string; score: number; rank: string }[];
  decay: string[];
}
