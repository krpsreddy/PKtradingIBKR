import { SetupMaturity } from './execution.model';

export interface ExpectedMove {
  setupType: string;
  symbol: string;
  typicalMoveLowPercent: number | null;
  typicalMoveHighPercent: number | null;
  averageContinuationPercent: number | null;
  typicalRetracementPercent: number | null;
  summary: string;
}

export interface SetupHalfLife {
  setupType: string;
  peakEdgeMinutes: number;
  halfLifeMinutes: number;
  summary: string;
  timingGuidance: string;
}

export interface ProbabilityPoint {
  minuteOffset: number;
  continuation: number;
  failure: number;
}

export interface ProbabilityDecay {
  continuationProbability: number;
  exhaustionProbability: number;
  reversalProbability: number;
  failureProbability: number;
  continuationStart: number;
  continuationCurrent: number;
  trend: ProbabilityPoint[];
  exhaustionRisk: string;
}

export interface FailureSignature {
  failureProbability: number;
  severity: string;
  patterns: string[];
  message: string;
}

export interface SetupDna {
  personality: string;
  description: string;
  traits: string[];
}

export interface TradeExpectancy {
  expectedRr: number | null;
  historicalExpectancyR: number | null;
  winRate: number | null;
  qualityLabel: string;
  notes: string[];
}

export type AdaptiveExitState = 'HOLD' | 'SCALE_PARTIAL' | 'TAKE_PROFIT' | 'EXIT_SOON' | 'EXIT_NOW';

export interface AdaptiveExit {
  state: AdaptiveExitState;
  guidance: string;
  triggers: string[];
  optionsEdgeDeteriorating: boolean;
}

export interface DecisionQuality {
  label: string;
  detail: string;
  score: number;
}

export interface MarketTrust {
  score: number;
  label: string;
  factors: string[];
}

export interface OptionsExpectancy {
  idealHoldMinutes: number | null;
  moveSpeed: string;
  lateEntryDecayRisk: number | null;
  extensionRisk: number | null;
  warning: string | null;
}

export interface BiasAlert {
  type: string;
  message: string;
  severity: string;
}

export interface RegimeAdaptation {
  regime: string;
  setupType: string;
  confidenceAdjustment: number;
  message: string;
}

export interface WhyNow {
  headline: string;
  reasons: string[];
  convictionScore: number;
}

export interface CapitalPreservation {
  mode: string;
  message: string | null;
  reasons: string[];
}

export interface MarketEmotion {
  label: string;
  description: string;
}

export interface OptionsExecutionSnapshot {
  idealDirection: string;
  recommendedStrikeType: string;
  recommendedExpiry: string;
  strikeGuidance: string;
  expectedPremiumExpansion: string | null;
  expectedPremiumDeterioration: string | null;
  thetaRisk: string;
  thetaWarnings: string[];
  ivRisk: string;
  ivLabel: string;
  holdWindow: string;
  expectedMoveVelocity: string;
  optionExecutionQuality: number;
  optionConfidence: number;
  avoidReason: string | null;
  capitalPreservation: CapitalPreservation | null;
  marketEmotion: MarketEmotion | null;
}

export interface ProbabilisticExecutionSnapshot {
  expectedMove: ExpectedMove | null;
  halfLife: SetupHalfLife | null;
  probabilityDecay: ProbabilityDecay | null;
  failureSignature: FailureSignature | null;
  setupDna: SetupDna | null;
  expectancy: TradeExpectancy | null;
  adaptiveExit: AdaptiveExit | null;
  decisionQuality: DecisionQuality | null;
  marketTrust: MarketTrust | null;
  optionsExpectancy: OptionsExpectancy | null;
  biasAlerts: BiasAlert[];
  coachingEvolution: string[];
  topPriorities: string[];
  regimeAdaptation: RegimeAdaptation | null;
  whyNow: WhyNow | null;
  setupMaturity: SetupMaturity | null;
  optionsExecution: OptionsExecutionSnapshot | null;
  timestamp: number;
}

export interface ReplayProbabilistic {
  symbol: string;
  barIndex: number;
  probabilities: ProbabilityDecay | null;
  expectedMove: ExpectedMove | null;
  exitGuidance: AdaptiveExit | null;
  failure: FailureSignature | null;
}

export const EMPTY_PROBABILISTIC_SNAPSHOT: ProbabilisticExecutionSnapshot = {
  expectedMove: null,
  halfLife: null,
  probabilityDecay: null,
  failureSignature: null,
  setupDna: null,
  expectancy: null,
  adaptiveExit: null,
  decisionQuality: null,
  marketTrust: null,
  optionsExpectancy: null,
  biasAlerts: [],
  coachingEvolution: [],
  topPriorities: [],
  regimeAdaptation: null,
  whyNow: null,
  setupMaturity: null,
  optionsExecution: null,
  timestamp: 0
};
