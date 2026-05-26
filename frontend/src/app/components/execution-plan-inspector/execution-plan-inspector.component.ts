import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExecutionPlan } from '../../services/execution-plan/execution-plan.models';
import { ReplayDeterminismDrift } from '../../services/execution-plan/execution-plan.models';
import { ExecutionPlanService } from '../../services/execution-plan/execution-plan.service';
import { HistoricalExecutionSnapshot } from '../../services/execution-plan/execution-plan.models';

/** Phase 173D — research-mode execution plan inspector. */
@Component({
  selector: 'app-execution-plan-inspector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './execution-plan-inspector.component.html',
  styleUrl: './execution-plan-inspector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExecutionPlanInspectorComponent {
  @Input() plan: ExecutionPlan | null = null;
  @Input() historical: HistoricalExecutionSnapshot | null = null;
  @Input() drift: ReplayDeterminismDrift[] = [];

  constructor(private executionPlans: ExecutionPlanService) {}

  lines() {
    return this.executionPlans.inspectorLines(this.plan);
  }
}
