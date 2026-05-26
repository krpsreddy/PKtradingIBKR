import { EntryQuality, ExecutionGuidance, OptionsDirection, SetupCandidate } from '../../models/execution.model';
import { ExecutionSnapshot } from '../../models/refinement.model';
import { IndicatorSnapshot } from '../../models/indicator.model';
import { ProbabilisticExecutionSnapshot } from '../../models/probabilistic.model';
import { ClusterFamilyOverlay } from '../cluster-family-intelligence/cluster-family.models';
import { AutonomousExecutionOverlay } from '../signal-intelligence/autonomous-execution/autonomous-execution.models';
import { ScannerOpportunityCard } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';

/** Phase 172–173 — unified execution source for all trader-facing surfaces. */
export type ExecutionPlanSource = 'LEGACY_RR' | 'HISTORICAL_RR' | 'AUTONOMOUS_TEMPLATE';

export type ExecutionPlanLifecycleState =
  | 'DEVELOPING'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'EXTENDED'
  | 'EXHAUSTING'
  | 'FAILED';

export type ExecutionPlanDirection = 'LONG' | 'SHORT';

/** Phase 173C — guidance consolidated on plan (replaces scattered sidecars). */
export interface ExecutionPlanGuidance {
  warnings: string[];
  invalidations: string[];
  exhaustionNotes: string[];
  addLogic: string[];
  persistenceNotes: string[];
  coaching: string[];
  whyNow: string[];
  entryQuality?: EntryQuality;
  tradeQuality?: number;
  suggestedDirection?: OptionsDirection;
  exitLabel?: string;
}

export interface ExecutionPlan {
  source: ExecutionPlanSource;

  canonicalRegime?: string;
  clusterId?: string;

  lifecycleState?: ExecutionPlanLifecycleState;

  direction: ExecutionPlanDirection;

  entryZone: {
    low: number;
    high: number;
    ideal?: number;
  };

  stopZone: {
    price: number;
    invalidation?: number;
  };

  targetZone: {
    primary?: number;
    secondary?: number;
    trailing?: boolean;
  };

  riskReward?: number;

  conviction?: number;
  expansionProbability?: number;
  continuationPersistence?: number;

  exhaustionRisk?: number;

  addLevels?: number[];

  executionTemplate?: string;

  reasoning?: string[];

  guidance: ExecutionPlanGuidance;

  metadata?: Record<string, unknown>;
}

export interface ExecutionPlanBuildContext {
  source: SetupCandidate | null;
  price: number | null;
  indicators: IndicatorSnapshot | null;
  snapshot?: ExecutionSnapshot | null;
  extended?: boolean;
  autonomousOverlay?: AutonomousExecutionOverlay | null;
  clusterFamily?: ClusterFamilyOverlay | null;
  scannerCard?: ScannerOpportunityCard | null;
  probabilistic?: ProbabilisticExecutionSnapshot | null;
  /** Override plan source tag (e.g. HISTORICAL_RR). */
  planSource?: ExecutionPlanSource;
  replayTimestamp?: string;
}

export interface ExecutionPlanBuildResult {
  plan: ExecutionPlan | null;
  /** @deprecated Prefer plan.guidance — kept for gradual migration. */
  guidance: ExecutionGuidance | null;
}

/** Phase 174 — point-in-time replay execution state. */
export interface HistoricalExecutionSnapshot {
  timestamp: string;
  timestampMs: number;
  barIndex: number;
  price: number;
  vwap: number;
  ema9: number;
  ema20: number;
  rvol: number;
  persistence: number;
  conviction: number;
  lifecycleState: ExecutionPlanLifecycleState;
  canonicalRegime?: string;
  executionPlan: ExecutionPlan;
}

export interface ReplayDeterminismDrift {
  field: string;
  historical: string | number;
  live: string | number;
  severity: 'WARN' | 'CRITICAL';
}
