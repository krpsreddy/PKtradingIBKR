import { PaperExecutionRecord } from '../../models/paper-execution.model';
import { ExecutionFeedItem } from '../real-time-execution/real-time-execution.models';

/** Phase 182 — post-entry lifecycle states (advisory only). */
export type ExecutionLifecycleState =
  | 'ENTRY_ACTIVE'
  | 'PERSISTING'
  | 'SECOND_LEG_ACTIVE'
  | 'TRAILING_CONTINUATION'
  | 'REDUCE_RISK'
  | 'EXIT_WARNING'
  | 'EXIT_CRITICAL'
  | 'FAILED_CONTINUATION';

export type ExitAdvisoryKind =
  | 'HOLD_PERSISTENCE'
  | 'TRAIL_CONTINUATION'
  | 'REDUCE_INTO_EXTENSION'
  | 'SECOND_LEG_ACTIVE'
  | 'PERSISTENCE_WEAKENING'
  | 'EXIT_STRUCTURE_FAILURE'
  | 'VWAP_FAILURE_RISK'
  | 'EXHAUSTION_RISING'
  | 'MONITOR_RISK'
  | 'MANUAL_EXIT_READY';

export type LifecycleHealthTone = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export interface PostEntryTelemetry {
  persistenceScore: number;
  rvolSustainment: number;
  accelerationDecay: number;
  vwapIntegrity: number;
  pullbackQuality: number;
  secondLegSurvival: number;
  exhaustionRise: number;
  convictionDeterioration: number;
  breadthDeterioration: number;
}

export interface AssistedMetricBundle {
  holdQuality: number;
  continuationHealth: number;
  secondLegProbability: number;
  exitPressure: number;
  persistenceSurvival: number;
  postEntryMfeCapture: number;
}

export interface ExitAdvisory {
  kind: ExitAdvisoryKind;
  priority: number;
  message: string;
  tone: LifecycleHealthTone;
}

export interface AssistedPositionView {
  record: PaperExecutionRecord;
  feed: ExecutionFeedItem | null;
  lifecycleState: ExecutionLifecycleState;
  healthTone: LifecycleHealthTone;
  telemetry: PostEntryTelemetry;
  metrics: AssistedMetricBundle;
  advisories: ExitAdvisory[];
  primaryAdvisory: ExitAdvisory;
  unrealizedR: number | null;
  holdDurationSec: number;
}

export interface AssistedExitLearningStats {
  missedContinuationAfterExit: number;
  persistenceSurvivalAfterTrim: number;
  trailingContinuationEfficiency: number;
  prematureExitCount: number;
  secondLegCaptureCount: number;
  exhaustionFalsePositiveCount: number;
  avgPostExitExpansionPct: number;
  sampleCount: number;
}

export interface AssistedExitSnapshot {
  positions: AssistedPositionView[];
  learning: AssistedExitLearningStats;
  generatedAt: number;
}
