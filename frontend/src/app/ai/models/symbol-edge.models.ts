/** Phase 133 — multi-symbol edge intelligence models (analytics only). */

export type EdgeConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export type SymbolAnalysisStatus =
  | 'IDLE'
  | 'QUEUED'
  | 'LOADING_HISTORY'
  | 'EVALUATING'
  | 'ANALYZING_AI'
  | 'READY'
  | 'FAILED';

export interface OverallEdgeStats {
  trades: number;
  winRate: number;
  expectancy: number;
  avgMfe: number;
  avgMae: number;
  hit1RRate: number;
  hit2RRate: number;
  confidence: EdgeConfidenceLevel;
}

export interface SetupEdgeStats {
  type: string;
  sample: number;
  winRate: number;
  expectancy: number;
  avgMfe?: number;
  avgMae?: number;
  confidence: EdgeConfidenceLevel;
}

export interface RegimeEdgeStats {
  name: string;
  sample: number;
  winRate: number;
  expectancy: number;
  continuationQuality?: number;
  confidence: EdgeConfidenceLevel;
}

export interface BucketEdgeStats {
  bucket: string;
  sample: number;
  winRate: number;
  expectancy: number;
  avgMfe?: number;
  avgMae?: number;
  failureRate?: number;
  continuationRate?: number;
  confidence: EdgeConfidenceLevel;
}

export interface LateEntryPenalty {
  idealExpectancy: number;
  lateExpectancy: number;
  expectancyDropPct: number;
}

export interface SymbolEdgeCompressedSummary {
  symbol: string;
  lookbackDays: number;
  evaluatedTrades: number;
  overall: OverallEdgeStats;
  bestSetup: SetupEdgeStats | null;
  worstSetup: SetupEdgeStats | null;
  bestRegime: RegimeEdgeStats | null;
  worstRegime: RegimeEdgeStats | null;
  bestTimeWindow: string;
  lateEntryPenalty: LateEntryPenalty;
  premarketExtension: Record<string, BucketEdgeStats>;
  bySetup: SetupEdgeStats[];
  byRegime: RegimeEdgeStats[];
  byEntryQuality: BucketEdgeStats[];
  byRvol: BucketEdgeStats[];
  byTimeOfDay: BucketEdgeStats[];
}

export interface SymbolEdgeAiAnalysis {
  strengths: string[];
  weaknesses: string[];
  bestConditions: string[];
  avoidConditions: string[];
  optimizationSuggestions: string[];
  executionNotes: string[];
  confidence: EdgeConfidenceLevel;
  confidenceScore?: number;
  summary: string;
}

export interface SymbolEdgeAnalysisResponse {
  symbol: string;
  lookbackDays: number;
  dataSource: string;
  aggregateConfidence: EdgeConfidenceLevel;
  evaluatedTrades: number;
  deterministic: SymbolEdgeCompressedSummary;
  ai: SymbolEdgeAiAnalysis;
  provider: string;
  latencyMs: number;
  fallbackUsed: boolean;
  warnings: string[];
}

/** Persisted per-symbol edge intelligence profile. */
export interface SymbolEdgeProfile {
  symbol: string;
  lastUpdated: number;
  sampleCount: number;
  evaluatedTrades: number;
  edgeScore: number;
  personality: string;
  deterministic: SymbolEdgeCompressedSummary;
  analysis: SymbolEdgeAnalysisResponse | null;
  analysisDigest: string;
  historyLoadedAt?: number;
  status: SymbolAnalysisStatus;
  statusMessage?: string;
  error?: string;
}

/** Row in the all-symbol rankings table. */
export interface SymbolEdgeRankingRow {
  symbol: string;
  winRate: number;
  expectancy: number;
  bestSetup: string;
  worstRegime: string;
  edgeScore: number;
  sampleCount: number;
  personality: string;
  lastUpdated: number;
  status: SymbolAnalysisStatus;
}

export interface SymbolAnalysisJobOptions {
  loadHistory?: boolean;
  forceRefresh?: boolean;
}

export const SYMBOL_EDGE_PROFILES_STORAGE_KEY = 'symbol-edge-profiles-v1';

/** Seed symbols shown when watchlist is empty — not a default analysis target. */
export const SYMBOL_EDGE_SEED_SYMBOLS = ['NVDA', 'TSLA', 'PLTR', 'AMD', 'SMCI', 'NOW'] as const;
