import { ExecutionGuidance } from '../../models/execution.model';
import { ExecutionPlan } from './execution-plan.models';

/** Phase 175 — legacy vs autonomous side-by-side. */
export interface ExecutionPlanComparison {
  legacy: ExecutionPlan | null;
  autonomous: ExecutionPlan | null;
  legacyGuidance: ExecutionGuidance | null;
  autonomousGuidance: ExecutionGuidance | null;
}
