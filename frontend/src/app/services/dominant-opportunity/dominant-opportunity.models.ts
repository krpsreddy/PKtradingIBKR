import { ScannerOpportunityCard } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';
import { NanoScanResult } from '../real-time-execution/nano-scanner.engine';
import { MarketTrend } from '../../models/workspace.model';

export type DominantOpportunityState =
  | 'DOMINANT_NOW'
  | 'EMERGING_FAST'
  | 'INSTITUTIONAL_FLOW'
  | 'SECOND_LEG_DOMINANCE'
  | 'PERSISTENCE_LEADER'
  | 'WATCHLIST_READY'
  | 'DEGRADING'
  | 'EXHAUSTING';

export type MarketAttentionMode =
  | 'TREND_DAY'
  | 'CHOP_DAY'
  | 'EXHAUSTION_DAY'
  | 'LOW_PARTICIPATION'
  | 'OPENING_DRIVE'
  | 'AFTERNOON_CONTINUATION'
  | 'NEUTRAL';

export type PersistenceTier = 'ELITE' | 'STRONG' | 'MODERATE' | 'WEAK';
export type InstitutionalLabel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DominanceContext {
  card: ScannerOpportunityCard;
  nano?: NanoScanResult;
  marketMode: MarketAttentionMode;
  convictionDelta: number;
  degrading: boolean;
  exhausting: boolean;
  marketLeaderBoost: number;
}

export interface RankedDominantOpportunity {
  card: ScannerOpportunityCard;
  dominanceScore: number;
  attentionPriorityScore: number;
  state: DominantOpportunityState;
  convictionDelta: number;
  persistenceTier: PersistenceTier;
  institutionalLabel: InstitutionalLabel;
  regimeLabel: string;
  whyNowLine: string;
  velocityArrow: '↑' | '→' | '↓' | null;
  velocityDelta: number;
  /** 0 = full visibility, 1 = heavily suppressed */
  suppressWeight: number;
  badges: string[];
}

export interface DominantOpportunitySnapshot {
  computedAt: number;
  marketMode: MarketAttentionMode;
  marketLeader: string | null;
  dominant: RankedDominantOpportunity | null;
  emergingFast: RankedDominantOpportunity | null;
  topRanked: RankedDominantOpportunity[];
  degrading: RankedDominantOpportunity[];
}

export interface DominantRecomputeInput {
  cards: ScannerOpportunityCard[];
  nanoBoosts?: Map<string, NanoScanResult>;
  marketTrend?: MarketTrend | null;
  watchlistSymbols?: string[];
}

export interface ConvictionSample {
  at: number;
  conviction: number;
}
