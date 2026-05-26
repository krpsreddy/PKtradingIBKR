import { ChartExecutionLevel, TradeStructureOverlay } from '../../models/execution.model';
import { ProbabilisticExecutionSnapshot } from '../../models/probabilistic.model';
import { ExecutionPlan } from './execution-plan.models';

/** Converts ExecutionPlan → chart levels and trade corridor (replaces buildChartLevels). */
export class ExecutionPlanOverlayEngine {
  toChartLevels(plan: ExecutionPlan | null, price: number | null): ChartExecutionLevel[] {
    if (!plan || price == null) return [];

    const levels: ChartExecutionLevel[] = [];
    const { entryZone, stopZone, targetZone, metadata } = plan;

    levels.push({
      price: entryZone.low,
      label: 'Entry',
      color: '#22c55e88',
      lineStyle: 2,
      zone: 'entry'
    });

    if (entryZone.high !== entryZone.low) {
      levels.push({
        price: entryZone.high,
        label: 'Entry+',
        color: '#22c55e55',
        lineStyle: 2,
        zone: 'entry'
      });
    }

    levels.push({
      price: stopZone.price,
      label: 'Stop',
      color: '#ef535088',
      lineStyle: 2,
      zone: 'stop'
    });

    if (stopZone.invalidation != null) {
      levels.push({
        price: stopZone.invalidation,
        label: 'Invalid',
        color: '#ef5350',
        lineStyle: 0,
        zone: 'invalid'
      });
    }

    const chartTarget =
      (metadata?.['chartTargetPrice'] as number | null | undefined) ??
      targetZone.secondary ??
      targetZone.primary;

    if (chartTarget != null) {
      levels.push({
        price: chartTarget,
        label: 'Target',
        color: '#a371f788',
        lineStyle: 2,
        zone: 'target'
      });
    }

    if (metadata?.['extended'] && price) {
      levels.push({
        price: price * 1.02,
        label: 'EXT',
        color: '#bc8cff',
        lineStyle: 1
      });
    }

    return levels;
  }

  toTradeStructureOverlay(
    plan: ExecutionPlan | null,
    probabilistic: ProbabilisticExecutionSnapshot | null,
    hasSetup: boolean
  ): TradeStructureOverlay | null {
    if (!hasSetup || !plan) return null;

    const fail = probabilistic?.failureSignature?.failureProbability ?? null;
    const maturity = probabilistic?.setupMaturity?.stage ?? null;

    let status = 'WATCH';
    if (probabilistic?.adaptiveExit?.state === 'EXIT_NOW') status = 'EXIT';
    else if (maturity === 'CONFIRMED' || maturity === 'TRIGGERED') status = 'ACTIVE';
    else if (maturity === 'BUILDING') status = 'BUILDING';

    const target = plan.targetZone.primary ?? plan.targetZone.secondary ?? plan.entryZone.low;

    return {
      active: status === 'ACTIVE' || status === 'BUILDING',
      entryLow: plan.entryZone.low,
      entryHigh: plan.entryZone.high,
      stopZone: plan.stopZone.price,
      targetZone: target,
      invalidation: plan.stopZone.invalidation ?? plan.stopZone.price,
      rr: plan.riskReward ?? null,
      failurePct: fail,
      statusLabel: status,
      maturityStage: maturity
    };
  }
}
