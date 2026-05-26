import { ExecutionPlanLifecycleState } from '../execution-plan/execution-plan.models';
import { AutonomousTemplateMetrics } from './autonomous-template.models';
import { lifecycleTargetScaleCalibrated } from './template-calibration.util';

/** Lifecycle tightness: 1 = normal, <1 = wider (developing), >1 = tighter (extended/exhausting). */
export function lifecycleEntryTightness(lifecycle: ExecutionPlanLifecycleState): number {
  switch (lifecycle) {
    case 'DEVELOPING': return 0.9;
    case 'CONFIRMING': return 0.97;
    case 'CONFIRMED': return 1;
    case 'EXTENDED': return 1.04;
    case 'EXHAUSTING': return 1.08;
    case 'FAILED': return 1.12;
    default: return 1;
  }
}

export function lifecycleStopTightness(lifecycle: ExecutionPlanLifecycleState): number {
  switch (lifecycle) {
    case 'DEVELOPING': return 1.1;
    case 'CONFIRMING': return 1.03;
    case 'CONFIRMED': return 1;
    case 'EXTENDED': return 0.94;
    case 'EXHAUSTING': return 0.88;
    case 'FAILED': return 0.82;
    default: return 1;
  }
}

/** @deprecated Use lifecycleTargetScaleCalibrated with metrics in target engine. */
export function lifecycleTargetScale(lifecycle: ExecutionPlanLifecycleState): number {
  return lifecycleTargetScaleCalibrated(lifecycle, {
    price: 0,
    conviction: 50,
    expansionProbability: 50,
    continuationPersistence: 50,
    exhaustionProbability: 30,
    triggerIntegrity: 50,
    institutionalPressure: 50,
    executionQuality: 50,
    relativeVolume: 1,
    extended: false
  });
}

export { lifecycleTargetScaleCalibrated };
