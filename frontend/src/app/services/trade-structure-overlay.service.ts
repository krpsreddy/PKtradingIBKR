import { Injectable } from '@angular/core';
import { TradeStructureOverlay } from '../models/execution.model';
import { ProbabilisticExecutionSnapshot } from '../models/probabilistic.model';
import { ExecutionPlan } from './execution-plan/execution-plan.models';
import { ExecutionPlanService } from './execution-plan/execution-plan.service';

@Injectable({ providedIn: 'root' })
export class TradeStructureOverlayService {
  constructor(private executionPlanService: ExecutionPlanService) {}

  /** Phase 172 — corridor overlay from unified ExecutionPlan only. */
  buildFromPlan(
    plan: ExecutionPlan | null,
    probabilistic: ProbabilisticExecutionSnapshot | null,
    hasSetup: boolean
  ): TradeStructureOverlay | null {
    return this.executionPlanService.toTradeStructureOverlay(plan, probabilistic, hasSetup);
  }
}
