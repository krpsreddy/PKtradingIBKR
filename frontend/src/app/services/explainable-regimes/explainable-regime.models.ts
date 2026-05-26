import { LiveRegimeClassification, LiveRegimeType } from '../live-regime-intelligence/live-regime.models';
import { PreExpansionFeatureVector } from '../signal-intelligence/autonomous-discovery/autonomous-discovery.models';

/** Phase 170 — fully numeric regime explanation (no vague quantile labels). */

export interface NumericThresholdCheck {
  feature: string;
  formula: string;
  actual: number | string;
  threshold: number | string;
  operator: '>' | '>=' | '<' | '<=' | '==' | 'between';
  passed: boolean;
  unit?: string;
  contribution?: number;
}

export interface FeatureContribution {
  feature: string;
  formula: string;
  delta: number;
  runningTotal: number;
  reason: string;
}

export interface ReplayExplainTimelineEvent {
  time: string;
  timestampMs: number;
  event: string;
  metric?: string;
  actual?: number | string;
  threshold?: number | string;
  detail?: string;
}

export interface StrategyExplainableSpec {
  strategyId: string;
  strategyName: string;
  entryFormulas: Record<string, string>;
  thresholdRefs: Record<string, number>;
  featureWeights: Record<string, number>;
  lifecycleConditions: string[];
  addLogic: string[];
  exhaustionRules: string[];
}

export interface ExplainableRegimeExplanation {
  advisoryOnly: true;
  regimeType: LiveRegimeType;
  regimeLabel: string;
  classification: LiveRegimeClassification;
  symbol?: string;
  entryConditions: NumericThresholdCheck[];
  invalidationConditions: NumericThresholdCheck[];
  triggerSequence: ReplayExplainTimelineEvent[];
  featureContributions: FeatureContribution[];
  convictionBase: number;
  finalConviction: number;
  whyEntryValid: string[];
  whyEntryInvalidated: string[];
  whyConfidenceIncreased: string[];
  whyConfidenceDropped: string[];
  whyExtensionHealthy: string[];
  whyExhaustionDetected: string[];
  persistenceLogic: string[];
  exhaustionRules: string[];
  formulas: Record<string, string>;
  rawMetrics: Record<string, number | string | boolean>;
  strategySpec?: StrategyExplainableSpec;
  debugMode: boolean;
}

export interface ExplainableClusterContext {
  centroid?: PreExpansionFeatureVector;
  breakpoints?: Record<string, number[]>;
  sessionRvolMedian?: number;
}
