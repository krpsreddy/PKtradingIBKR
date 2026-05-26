import { ExecutionPlanLifecycleState } from '../execution-plan/execution-plan.models';
import { ReplaySignalEvent } from '../../models/replay.model';

export class HistoricalLifecycleEngine {
  fromEvent(event: ReplaySignalEvent | null, extended?: boolean): ExecutionPlanLifecycleState {
    if (extended) return 'EXTENDED';
    const life = (event?.lifecycleState ?? '').toUpperCase();
    if (life.includes('EXIT') || life.includes('FAIL')) return 'FAILED';
    if (life.includes('READY') || life.includes('CONFIRM')) return 'CONFIRMED';
    if (life.includes('WEAK')) return 'EXHAUSTING';
    return 'DEVELOPING';
  }
}
