export interface CognitionSnapshot {
  setupNarrative: SetupNarrative | null;
  sessionPriority: SessionPriority | null;
  sessionTemperature: SessionTemperature | null;
  coachingFeed: CoachingFeedItem[];
  marketPersonality: MarketPersonality | null;
  premarket: PremarketBrief | null;
  personalized: PersonalizedCoaching | null;
  discipline: TraderDiscipline | null;
  events: IntelligenceEvent[];
  memoryNarrative: MarketMemoryNarrative | null;
  probabilisticGuidance: ProbabilisticGuidance | null;
  summary: IntelligenceSummary | null;
  aiSessionReview: AiSessionReview | null;
  heatmap: PerformanceHeatmap | null;
  visualEmphasis: VisualEmphasis | null;
  timestamp: number;
}

export interface SetupNarrative {
  symbol: string;
  narrative: string;
  signalType?: string;
  highlights: string[];
  cautions: string[];
}

export interface SessionPriority {
  insight: string;
  category: string;
  severity: 'high' | 'medium' | 'low' | string;
  detail: string;
}

export interface SessionTemperature {
  label: string;
  description: string;
  intensity: number;
}

export interface CoachingFeedItem {
  type: string;
  message: string;
  severity: 'warn' | 'good' | 'info' | string;
  timestamp: number;
}

export interface MarketPersonality {
  personality: string;
  description: string;
  traits: string[];
}

export interface PremarketBrief {
  active: boolean;
  likelyRegime: string | null;
  overnightMovers: string[];
  highGapNames: string[];
  strongestSectors: string[];
  likelyMomentumSymbols: string[];
  notes: string[];
}

export interface PersonalizedCoaching {
  insights: string[];
  strongestEdge: string | null;
  weakestPattern: string | null;
}

export interface TraderDiscipline {
  score: number;
  label: string;
  factors: string[];
}

export interface IntelligenceEvent {
  id: string;
  type: string;
  message: string;
  severity: string;
  symbol: string | null;
  timestamp: number;
}

export interface MarketMemoryNarrative {
  narratives: string[];
}

export interface ProbabilisticGuidance {
  continuationProbability: number | null;
  openingMomentumProbability: number | null;
  bestRegime: string | null;
  weakRegime: string | null;
  bestEntryQuality: string | null;
  historicalRrAverage: number | null;
  signalType: string | null;
}

export interface IntelligenceSummary {
  whatMattersMost: string;
  whatToAvoid: string;
  strongestSetupsToday: string;
  behaviorHurtingPerformance: string;
  activeRegime: string;
  bestPlaybookToday: string;
}

export interface AiSessionReview {
  narrative: string;
  bestOpportunities: string[];
  strongestSectors: string[];
  failedPatterns: string[];
  traderStrengths: string[];
  traderMistakes: string[];
  regimeTransitions: string[];
  behaviorCoaching: string[];
  bestPlaybook: string;
}

export interface PerformanceHeatmap {
  setupWinRates: Record<string, number>;
  timeWindowWinRates: Record<string, number>;
  regimeWinRates: Record<string, number>;
  worstBehaviors: string[];
  executionQualityDistribution: Record<string, number>;
  rrDistribution: Record<string, number>;
}

export interface VisualEmphasis {
  highPriorityTarget: string;
  highPriorityClass: string;
  mutedTargets: string[];
}

export interface ReplayNarrative {
  symbol: string;
  narrative: string;
  improvements: string[];
  deteriorations: string[];
  idealEntries: string[];
}

export const EMPTY_COGNITION: CognitionSnapshot = {
  setupNarrative: null,
  sessionPriority: null,
  sessionTemperature: null,
  coachingFeed: [],
  marketPersonality: null,
  premarket: null,
  personalized: null,
  discipline: null,
  events: [],
  memoryNarrative: null,
  probabilisticGuidance: null,
  summary: null,
  aiSessionReview: null,
  heatmap: null,
  visualEmphasis: null,
  timestamp: 0
};
