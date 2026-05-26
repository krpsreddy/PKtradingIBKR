import { ExecutionPlan } from '../execution-plan/execution-plan.models';

/** Phase 167 — real-time autonomous execution models. */

export type ExecutionMaturityState =
  | 'DEVELOPING'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'EXTENDED'
  | 'EXHAUSTING'
  | 'FAILED';

export type ExecutionFrameworkMode167 = 'EARLY' | 'CONFIRMED';

export interface ConfidencePoint {
  timestamp: number;
  conviction: number;
}

export interface ExecutionFeedItem {
  symbol: string;
  opportunityType: string;
  action: string;
  tone: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  badge: string;
  maturityState: ExecutionMaturityState;
  executionMode: ExecutionFrameworkMode167;
  preConfirmation: boolean;
  conviction: number;
  convictionVelocity: number;
  expansionProbability: number;
  triggerIntegrity: number;
  persistenceSeconds: number;
  whyNow: string[];
  entryZoneLabel: string;
  riskLabel: string;
  /** Phase 173A — unified execution levels (replaces independent entry/RR math). */
  executionPlan?: ExecutionPlan | null;
  confidenceTimeline: ConfidencePoint[];
  updatedAt: number;
}

export interface ExecutionFeedSnapshot {
  advisoryOnly: true;
  generatedAt: number;
  symbolCount: number;
  nanoScanGeneration: number;
  feed: ExecutionFeedItem[];
  summaryInsights: string[];
}

export interface StrategyDefinition {
  strategyId: string;
  strategyName: string;
  category: string;
  conditions: string[];
  thresholds: Record<string, number>;
  winRate: number;
  avgR: number;
  robustness: number;
  active: boolean;
  deprecated: boolean;
  replayExamples: string[];
  discoveredFromPhase: number;
  notes: string;
  version: number;
  governanceTags: string[];
  /** Phase 169 — optional runtime stats */
  lastActivationAt?: number;
  hitRate?: number;
  lifecycleConditions?: Record<string, string[]>;
  triggerConditions?: string[];
  invalidationConditions?: string[];
  addConditions?: string[];
  exhaustionConditions?: string[];
}
