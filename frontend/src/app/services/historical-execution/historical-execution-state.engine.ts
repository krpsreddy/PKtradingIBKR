import { Injectable } from '@angular/core';
import {
  HistoricalExecutionSnapshot,
  ReplayDeterminismDrift
} from '../execution-plan/execution-plan.models';
import { ExecutionPlan } from '../execution-plan/execution-plan.models';

/** Compare historical vs live plan for drift diagnostics. */
@Injectable({ providedIn: 'root' })
export class HistoricalExecutionStateEngine {
  validateDeterminism(
    historical: HistoricalExecutionSnapshot | null,
    live: ExecutionPlan | null
  ): ReplayDeterminismDrift[] {
    if (!historical?.executionPlan || !live) return [];
    const h = historical.executionPlan;
    const drifts: ReplayDeterminismDrift[] = [];

    const cmp = (field: string, a: number | undefined, b: number | undefined, tol = 0.02) => {
      if (a == null || b == null) return;
      const pct = Math.abs(a - b) / Math.max(Math.abs(a), 0.01);
      if (pct > tol) {
        drifts.push({
          field,
          historical: Math.round(a * 100) / 100,
          live: Math.round(b * 100) / 100,
          severity: pct > 0.08 ? 'CRITICAL' : 'WARN'
        });
      }
    };

    cmp('entry.ideal', h.entryZone.ideal, live.entryZone.ideal);
    cmp('stop', h.stopZone.price, live.stopZone.price);
    cmp('target', h.targetZone.primary, live.targetZone.primary);
    cmp('rr', h.riskReward, live.riskReward);

    if (h.source !== live.source) {
      drifts.push({
        field: 'source',
        historical: h.source,
        live: live.source,
        severity: 'WARN'
      });
    }

    return drifts;
  }
}
