import { CanonicalExecutionRegime } from '../cluster-family-intelligence/cluster-family.models';
import { SignalEvaluation } from '../../models/signal-intelligence.model';

export type ValidationPlanMode = 'LEGACY_RR' | 'AUTONOMOUS_TEMPLATE';

export type DefaultModeRecommendation = 'LEGACY_RR' | 'AUTONOMOUS_TEMPLATE' | 'HYBRID';

export type ValidationConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** Phase 177 — production readiness from statistical gates only. */
export type TemplateReadinessStatus = 'NOT_READY' | 'HYBRID_READY' | 'DEFAULT_READY';

export const VALIDATION_MIN_EVENTS = 500;
export const VALIDATION_MIN_SYMBOLS = 5;
export const VALIDATION_MIN_REGIMES = 4;

export type MarketConditionTag =
  | 'STRONG_TREND'
  | 'WEAK_BREADTH'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'OPENING_DRIVE'
  | 'AFTERNOON_CONTINUATION'
  | 'CHOP'
  | 'EXHAUSTION_DAY';

export interface ModeAggregateMetrics {
  mode: ValidationPlanMode;
  sampleCount: number;
  expectancy: number;
  winRate: number;
  averageR: number;
  mfeCapturePct: number;
  maeEfficiency: number;
  stopEfficiency: number;
  targetEfficiency: number;
  continuationCapture: number;
  exhaustionAvoidance: number;
  shallowPbEfficiency: number;
  addEfficiency: number;
  earlyExpansionCapture: number;
  vwapContinuationSuccess: number;
  compressionBreakoutSuccess: number;
  lateExtensionFailureRate: number;
}

export interface RegimeModeComparison {
  regime: CanonicalExecutionRegime;
  legacy: ModeAggregateMetrics;
  autonomous: ModeAggregateMetrics;
  winner: ValidationPlanMode | 'TIE';
  expectancyDelta: number;
  sampleCount: number;
}

export interface MarketConditionComparison {
  tag: MarketConditionTag;
  legacy: ModeAggregateMetrics;
  autonomous: ModeAggregateMetrics;
  winner: ValidationPlanMode | 'TIE';
  sampleCount: number;
}

export interface ValidationFailureMode {
  code: string;
  description: string;
  mode: ValidationPlanMode;
  sampleCount: number;
  severity: 'WARN' | 'CRITICAL';
}

export interface HybridRegimeRouting {
  regime: CanonicalExecutionRegime;
  recommendedMode: ValidationPlanMode;
  reason: string;
}

export interface ExecutionTemplateValidationReport {
  advisoryOnly: true;
  generatedAt: number;
  lookbackDays: number;
  sessionsScanned: number;
  eventsEvaluated: number;
  symbolsScanned: number;
  overallLegacy: ModeAggregateMetrics;
  overallAutonomous: ModeAggregateMetrics;
  overallWinner: ValidationPlanMode | 'TIE';
  overallExpectancyDelta: number;
  confidence: ValidationConfidence;
  regimeComparisons: RegimeModeComparison[];
  marketComparisons: MarketConditionComparison[];
  bestImprovements: string[];
  worstRegressions: string[];
  failureModes: ValidationFailureMode[];
  autonomousUnderperforms: string[];
  legacyStillStronger: string[];
  defaultRecommendation: DefaultModeRecommendation;
  hybridRouting: HybridRegimeRouting[];
  productionReady: boolean;
  productionReadyNotes: string[];
  remainingWeaknesses: string[];
  readinessStatus: TemplateReadinessStatus;
  insufficientSample: boolean;
  validationWarnings: string[];
  uniqueRegimes: number;
  uniqueMarketTags: number;
}

export interface ValidationProgress {
  phase: string;
  done: number;
  total: number;
}

export interface PlanOutcomeSample {
  mode: ValidationPlanMode;
  symbol: string;
  sessionDate: string;
  regime: CanonicalExecutionRegime;
  marketTags: MarketConditionTag[];
  signalType: string;
  extended: boolean;
  evaluation: SignalEvaluation;
  plannedRr: number | null;
  mfeCapturePct: number;
  addHit: boolean;
}
