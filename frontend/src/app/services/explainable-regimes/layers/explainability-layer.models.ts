/** Phase 208 — layered explainability (semantics separate from engineering). */
export type ExplainabilityDirection = 'BULLISH' | 'BEARISH';

export interface EngineeringTriggerLine {
  label: string;
  actual: number | string;
  operator: string;
  threshold: number | string;
  passed: boolean;
  engineeringKey?: string;
}

export interface ConfidenceContributorLine {
  label: string;
  delta: number;
  runningTotal?: number;
}

export interface LifecycleStepLine {
  phase: string;
  detail?: string;
}

export interface FormulaDebugLine {
  term: string;
  delta: number;
  note?: string;
}

export interface RawDiscoveryStatLine {
  dimension: string;
  label: string;
  value: string;
}

export interface LayeredExplainability {
  direction: ExplainabilityDirection;
  clusterName: string;
  regimeLabel: string;
  finalScore: number;

  structuralSummary: string;
  exactTriggers: EngineeringTriggerLine[];
  structuralInterpretation: string[];
  confidenceContributors: ConfidenceContributorLine[];
  lifecycleEvolution: LifecycleStepLine[];
  invalidatesIf: string[];
  formulaDebug: {
    headline: string;
    base: number;
    lines: FormulaDebugLine[];
    formulas: Record<string, string>;
  };
  rawDiscoveryStats: RawDiscoveryStatLine[];
  triggerSequence: { time: string; event: string; detail?: string }[];
}
