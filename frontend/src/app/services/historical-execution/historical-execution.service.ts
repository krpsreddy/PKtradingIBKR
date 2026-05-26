import { Injectable } from '@angular/core';
import {
  HistoricalExecutionSnapshot,
  ReplayDeterminismDrift
} from '../execution-plan/execution-plan.models';
import { HistoricalExecutionPlanEngine, HistoricalPlanBuildInput } from './historical-execution-plan.engine';
import { HistoricalExecutionStateEngine } from './historical-execution-state.engine';

@Injectable({ providedIn: 'root' })
export class HistoricalExecutionService {
  constructor(
    private readonly planEngine: HistoricalExecutionPlanEngine,
    private readonly stateEngine: HistoricalExecutionStateEngine
  ) {}

  buildSnapshot(input: HistoricalPlanBuildInput): HistoricalExecutionSnapshot | null {
    return this.planEngine.build(input);
  }

  validateDrift(
    historical: HistoricalExecutionSnapshot | null,
    livePlan: import('../execution-plan/execution-plan.models').ExecutionPlan | null
  ): ReplayDeterminismDrift[] {
    return this.stateEngine.validateDeterminism(historical, livePlan);
  }
}
