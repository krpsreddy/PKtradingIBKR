import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { EXECUTION_REVIEW_ROUTES } from './execution-review.routes';

/** Phase 190 — route barrel (component is standalone). */
@NgModule({
  imports: [RouterModule.forChild(EXECUTION_REVIEW_ROUTES)],
  exports: [RouterModule]
})
export class ExecutionReviewModule {}
