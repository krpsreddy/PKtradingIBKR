export type AiExecutionState = 'WATCHING' | 'READY' | 'TRIGGERED' | 'MANAGING' | 'EXITING';
export type AiEntryQuality = 'IDEAL' | 'GOOD' | 'LATE' | 'CHASE' | 'AVOID';
export type AiRecommendedAction = 'ENTER' | 'WAIT' | 'AVOID' | 'REDUCE_SIZE' | 'EXIT';

export interface AiExecutionRequest {
  symbol: string;
  signalType: string;
  marketRegime: string;
  rvol: number;
  trendAlignment: number;
  convictionScore: number;
  premarketExtension: number;
  entryDistanceFromVWAP: number;
  historicalWinRate: number;
  expectancyR: number;
  fakeoutRisk?: number;
  currentState: AiExecutionState;
  marketBreadth: string;
  openType?: string;
}

export interface AiExecutionResponse {
  provider: string;
  latencyMs: number;
  available: boolean;
  fallbackUsed: boolean;
  continuationProbability?: number;
  fakeoutProbability?: number;
  entryQuality?: AiEntryQuality;
  recommendedAction?: AiRecommendedAction;
  suggestedEntry?: string;
  reasoning?: string[];
  confidence?: number;
  summary?: string;
  compactLine?: string;
  warnings?: string[];
}

export interface OpenStructureResponse {
  provider: string;
  latencyMs: number;
  available: boolean;
  fallbackUsed: boolean;
  classification: string;
  structureAssessment: string;
  entryTimingGuidance: string;
  compactLine?: string;
  warnings?: string[];
  confidence?: number;
}

export interface CoachingResponse {
  provider: string;
  latencyMs: number;
  available: boolean;
  fallbackUsed: boolean;
  headline: string;
  suggestions: string[];
  psychologyNotes: string[];
  confidence?: number;
}

export interface AiProviderStatus {
  enabled: boolean;
  configuredProvider: string;
  activeProvider: string;
  providerAvailable: boolean;
  model: string;
  message: string;
}

export const EMPTY_AI_EXECUTION: AiExecutionResponse = {
  provider: 'noop',
  latencyMs: 0,
  available: false,
  fallbackUsed: true,
  warnings: [],
  reasoning: []
};

export const EMPTY_COACHING: CoachingResponse = {
  provider: 'noop',
  latencyMs: 0,
  available: false,
  fallbackUsed: true,
  headline: '',
  suggestions: [],
  psychologyNotes: []
};
