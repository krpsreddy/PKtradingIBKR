import { MarketRegime } from '../../../models/signal-intelligence.model';
import { AutonomousOpportunityType } from '../../autonomous-regime-scanner/autonomous-regime-scanner.models';

/** Phase 139 — playbook candidate discovery (human review only, no auto-trading). */

export type PlaybookConfidenceBand = 'IGNORE' | 'EXPERIMENTAL' | 'DEVELOPING' | 'STABLE';

export type PlaybookEvolutionState =
  | 'DISCOVERED'
  | 'EXPERIMENTAL'
  | 'STABLE'
  | 'WEAKENING'
  | 'DEPRECATED';

export type PlaybookPromotionState =
  | 'DISCOVERED'
  | 'REVIEWED'
  | 'APPROVED'
  | 'ACTIVE_PLAYBOOK';

export interface PlaybookSequenceStep {
  setup: AutonomousOpportunityType;
  regime: MarketRegime;
  rvolBucket: string;
  timeWindow: string;
  contextTags: string[];
}

export interface PlaybookCandidate {
  id: string;
  name: string;
  description: string;
  sequence: PlaybookSequenceStep[];
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  avgMfe: number;
  avgMae: number;
  continuationStrength: number;
  fakeoutRate: number;
  confidence: PlaybookConfidenceBand;
  stability: number;
  qualityScore: number;
  regimes: string[];
  bestTimeWindows: string[];
  bestSymbols: string[];
  suppressionConditions: string[];
  optimalEntryZones?: string[];
  avoidEntryZones?: string[];
  uniqueSymbols: number;
  uniqueSessions: number;
  evolutionState: PlaybookEvolutionState;
  promotionState: PlaybookPromotionState;
  discoveredAt: number;
  lastUpdated: number;
  advisoryOnly: true;
}

export interface PlaybookEvolutionEvent {
  candidateId: string;
  at: number;
  from: PlaybookEvolutionState;
  to: PlaybookEvolutionState;
  expectancyR: number;
  sampleCount: number;
  message: string;
}

export interface PlaybookSimulationResult {
  candidateId: string;
  expectancyR: number;
  winRate: number;
  fakeoutRate: number;
  maxDrawdownR: number;
  regimeSensitivity: { regime: string; expectancyR: number; count: number }[];
  sampleCount: number;
  advisoryOnly: true;
}

export interface PlaybookRelationship {
  candidateA: string;
  candidateB: string;
  type: 'OVERLAP' | 'CONTRADICTORY' | 'REDUNDANT' | 'COMPETING';
  overlapPct: number;
  message: string;
}

export interface PlaybookDiscoveryDiagnostics {
  totalSignals: number;
  evaluatedSignals: number;
  sessionGroups: number;
  rawSequenceBuckets: number;
  bucketsAboveMinSamples: number;
  rejectedLowExpectancy: number;
  rejectedStability: number;
  rejectedFakeout: number;
  qualified: number;
  message: string;
}

export interface PlaybookNearMiss {
  name: string;
  sampleCount: number;
  expectancyR: number;
  reason: string;
}

export interface PlaybookDiscoverySnapshot {
  generatedAt: number;
  lookbackDays: number;
  totalEvaluated: number;
  candidates: PlaybookCandidate[];
  emerging: PlaybookCandidate[];
  weakening: PlaybookCandidate[];
  relationships: PlaybookRelationship[];
  simulations: PlaybookSimulationResult[];
  diagnostics: PlaybookDiscoveryDiagnostics;
  nearMisses: PlaybookNearMiss[];
  aiSummary: PlaybookAiSummary;
  advisoryOnly: true;
}

export interface PlaybookAiSummary {
  summary: string;
  observations: string[];
  provider: 'deterministic';
  fallbackUsed: true;
}

export const PLAYBOOK_CANDIDATES_STORAGE_KEY = 'pk-playbook-candidates-v1';
