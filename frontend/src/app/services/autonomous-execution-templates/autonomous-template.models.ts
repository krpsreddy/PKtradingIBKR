import { CanonicalExecutionRegime } from '../cluster-family-intelligence/cluster-family.models';
import { IndicatorSnapshot } from '../../models/indicator.model';
import { SetupCandidate } from '../../models/execution.model';
import { ProbabilisticExecutionSnapshot } from '../../models/probabilistic.model';
import { ScannerOpportunityCard } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';
import { ClusterFamilyOverlay } from '../cluster-family-intelligence/cluster-family.models';
import {
  ExecutionPlanDirection,
  ExecutionPlanLifecycleState
} from '../execution-plan/execution-plan.models';

/** Phase 175 — execution plan build mode (feature flag). */
export type ExecutionPlanMode = 'LEGACY_RR' | 'AUTONOMOUS_TEMPLATE' | 'COMPARE';

export interface AutonomousTemplateMetrics {
  price: number;
  conviction: number;
  expansionProbability: number;
  continuationPersistence: number;
  exhaustionProbability: number;
  triggerIntegrity: number;
  institutionalPressure: number;
  executionQuality: number;
  relativeVolume: number;
  extended: boolean;
}

export interface AutonomousTemplateContext {
  source: SetupCandidate;
  price: number;
  indicators: IndicatorSnapshot;
  direction: ExecutionPlanDirection;
  regime: CanonicalExecutionRegime;
  lifecycle: ExecutionPlanLifecycleState;
  metrics: AutonomousTemplateMetrics;
  scannerCard?: ScannerOpportunityCard | null;
  clusterFamily?: ClusterFamilyOverlay | null;
  probabilistic?: ProbabilisticExecutionSnapshot | null;
  narrativeStrength: number;
  accelerationIntegrity: number;
}

export interface TemplateEntryResult {
  low: number;
  high: number;
  ideal: number;
  style: string;
  aggressive: boolean;
}

export interface TemplateStopResult {
  price: number;
  style: string;
  volatilityAdjusted: boolean;
}

export interface TemplateTargetResult {
  primary: number;
  secondary?: number;
  trailing: boolean;
  projectionLabel: string;
  adaptiveMultiple: number;
}

export interface TemplateAddResult {
  levels: number[];
  labels: string[];
}

export interface TemplateInvalidationResult {
  level: number;
  rules: string[];
}

export interface TemplateExitResult {
  exitLabel: string;
  exhaustionPriority: boolean;
  trimBias: boolean;
}

export interface RegimeTemplateDefinition {
  regime: CanonicalExecutionRegime;
  templateId: string;
  displayName: string;
  entryStyle: string;
  stopStyle: string;
  targetStyle: string;
  allowsEntry: boolean;
  baseRewardMultiple: number;
  stopWidthPct: number;
  entryAggression: number;
}
