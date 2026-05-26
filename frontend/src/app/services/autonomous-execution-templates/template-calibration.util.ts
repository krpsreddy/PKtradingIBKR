import { AutonomousTemplateMetrics } from './autonomous-template.models';
import { ExecutionPlanLifecycleState } from '../execution-plan/execution-plan.models';
import { CanonicalExecutionRegime } from '../cluster-family-intelligence/cluster-family.models';

/** Phase 177 — calibration helpers (persistence override, exhaustion dampening). */

/** Strong RVOL + persistence + acceleration can hold continuation targets through mild extension. */
export function persistenceContinuationOverride(metrics: AutonomousTemplateMetrics): boolean {
  return metrics.continuationPersistence >= 62
    && metrics.relativeVolume >= 1.35
    && metrics.triggerIntegrity >= 52
    && metrics.exhaustionProbability < 48;
}

/** Softer exhaustion penalty when momentum quality is intact. */
export function exhaustionShrinkFactor(metrics: AutonomousTemplateMetrics): number {
  const base = 1 - (metrics.exhaustionProbability / 100) * 0.22;
  if (persistenceContinuationOverride(metrics)) {
    return Math.max(base, 0.92);
  }
  return Math.max(0.72, base);
}

export function lifecycleTargetScaleCalibrated(
  lifecycle: ExecutionPlanLifecycleState,
  metrics: AutonomousTemplateMetrics
): number {
  const hold = persistenceContinuationOverride(metrics);
  switch (lifecycle) {
    case 'DEVELOPING': return 0.9;
    case 'CONFIRMING': return 0.98;
    case 'CONFIRMED': return 1;
    case 'EXTENDED': return hold ? 0.94 : 0.86;
    case 'EXHAUSTING': return hold ? 0.78 : 0.58;
    case 'FAILED': return 0.35;
    default: return 1;
  }
}

export function regimeTargetBoost(regime: CanonicalExecutionRegime): number {
  switch (regime) {
    case 'INSTITUTIONAL_PERSISTENCE': return 1.12;
    case 'EARLY_EXPANSION': return 1.1;
    case 'SHALLOW_PULLBACK_CONTINUATION': return 1.08;
    case 'PERSISTENT_CONTINUATION': return 1.06;
    case 'VWAP_ACCEPTANCE': return 1.04;
    default: return 1;
  }
}

export function rvolSustainmentMult(relativeVolume: number): number {
  if (relativeVolume >= 2.5) return 1.14;
  if (relativeVolume >= 1.6) return 1.08;
  if (relativeVolume >= 1.2) return 1.03;
  return 0.98;
}
