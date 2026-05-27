/** Phase 183 — shadow exit research (paper only, no broker exits). */

export type ShadowExitModelId =
  | 'LEGACY_RR'
  | 'AUTONOMOUS_TEMPLATE'
  | 'PERSISTENCE_TRAIL'
  | 'SECOND_LEG_HOLD'
  | 'VWAP_PERSISTENCE_EXIT'
  | 'EARLY_EXHAUSTION_EXIT'
  | 'ADAPTIVE_TRAIL';

export const ALL_SHADOW_EXIT_MODELS: ShadowExitModelId[] = [
  'LEGACY_RR',
  'AUTONOMOUS_TEMPLATE',
  'PERSISTENCE_TRAIL',
  'SECOND_LEG_HOLD',
  'VWAP_PERSISTENCE_EXIT',
  'EARLY_EXHAUSTION_EXIT',
  'ADAPTIVE_TRAIL'
];

export interface ShadowExitPath {
  modelId: ShadowExitModelId;
  tradeId: number;
  symbol: string;
  regime: string;
  simulatedExitR: number;
  exitReason: string;
  mfeAtExit: number;
  mfeRetainedPct: number;
  maeExperienced: number;
  continuationSurvivalAfterExit: boolean;
  postExitExpansionR: number;
  trimQuality: number;
  exhaustionQuality: number;
  continuationMonetizationEfficiency: number;
  simulatedAt: number;
}

export interface ShadowTradeContext {
  tradeId: number;
  symbol: string;
  regime: string;
  entryR: number;
  currentMfeR: number;
  currentMaeR: number;
  mfeR: number;
  realizedR?: number;
  closed: boolean;
  conviction: number;
  dominance: number;
  persistenceSec: number;
  expansionProb: number;
  maturityState: string;
}

export interface ModelRanking {
  modelId: ShadowExitModelId;
  sampleCount: number;
  avgRealizedR: number;
  avgMfeRetainedPct: number;
  avgContinuationEfficiency: number;
  avgMae: number;
  score: number;
}

export interface RegimeModelInsight {
  regime: string;
  bestModel: ShadowExitModelId;
  rankings: ModelRanking[];
}

export interface ExitResearchSnapshot {
  paths: ShadowExitPath[];
  rankings: ModelRanking[];
  regimeInsights: RegimeModelInsight[];
  continuationSurvivalCurve: { bucket: string; survivalPct: number }[];
  persistenceHalfLifeMin: number;
  secondLegRankings: { modelId: ShadowExitModelId; capturePct: number }[];
  generatedAt: number;
}
