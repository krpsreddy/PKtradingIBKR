import { ConditionCluster, DailyEdgeDiscoveryReport } from '../edge-discovery/edge-discovery.models';
import {
  ContinuationQualitySnapshot,
  EdgeTodaySnapshot,
  ExecutionPlaybookSnapshot,
  LiveCapitalAllocationRow,
  LiveExecutionContext,
  LiveExecutionGateSnapshot,
  LiveExecutionGateState,
  LiveExecutionMatrixRow,
  LiveFakeoutRiskLevel,
  MatrixConditionStatus,
  OpenTypeSnapshot,
  PremarketExtensionSnapshot,
  SuppressionRule
} from './live-execution.models';
import {
  breadthFromContext,
  gateLabel,
  normalizeRegime,
  normalizeSetup,
  rvolFromContext,
  timeFromContext
} from './live-execution-context.util';
import { formatAutonomousOpportunityType } from '../../../utils/autonomous-terminology.util';
import { ExecutionEdgeScoreEngine, sizeMultiplierFromScore } from './execution-edge-score.engine';
import { continuationMatrixStatus } from './continuation-quality.engine';
import { fakeoutMatrixStatus } from './live-fakeout-risk.engine';
import { openTypeStrength } from './open-type-classification.engine';

/** Real-time edge qualification — combines all Phase 137 inputs into gate state. */
export class LiveExecutionGateEngine {
  private readonly scoreEngine = new ExecutionEdgeScoreEngine();

  evaluate(input: {
    ctx: LiveExecutionContext;
    report: DailyEdgeDiscoveryReport | null;
    openType: OpenTypeSnapshot;
    premarket: PremarketExtensionSnapshot;
    continuation: ContinuationQualitySnapshot;
    fakeoutLevel: LiveFakeoutRiskLevel;
    fakeoutLabel: string;
    edgeToday: EdgeTodaySnapshot;
    capitalRank: LiveCapitalAllocationRow | null;
    capitalRows: LiveCapitalAllocationRow[];
    playbook: ExecutionPlaybookSnapshot;
    suppressions: SuppressionRule[];
  }): LiveExecutionGateSnapshot {
    const cluster = input.report
      ? this.matchCluster(input.report.discovery.clusters, input.ctx)
      : null;

    const toxic = input.report?.toxicConditions.some(t => this.matchesCluster(t, input.ctx)) ?? false;
    const discoveryScore = cluster?.edgeScore ?? input.capitalRank?.historicalEdge ?? 45;

    const executionScore = this.scoreEngine.score({
      ctx: input.ctx,
      cluster,
      continuation: input.continuation,
      fakeoutLevel: input.fakeoutLevel,
      openType: input.openType,
      premarket: input.premarket,
      suppressions: input.suppressions,
      discoveryEdgeScore: discoveryScore
    });

    const { state, reasons, headline, sublines } = this.resolveState({
      toxic,
      cluster,
      suppressions: input.suppressions,
      executionScore,
      continuation: input.continuation,
      fakeoutLevel: input.fakeoutLevel,
      openType: input.openType,
      edgeToday: input.edgeToday,
      ctx: input.ctx
    });

    const sizeMultiplier = sizeMultiplierFromScore(executionScore, state);
    const matrix = this.buildMatrix(input.ctx, input.openType, input.continuation, input.fakeoutLevel);

    return {
      state,
      label: gateLabel(state),
      headline,
      sublines,
      executionScore,
      sizeMultiplier,
      suppressions: input.suppressions,
      openType: input.openType,
      premarket: input.premarket,
      continuation: input.continuation,
      fakeoutRisk: input.fakeoutLevel,
      fakeoutLabel: input.fakeoutLabel,
      edgeToday: input.edgeToday,
      capitalRank: input.capitalRank,
      capitalRows: input.capitalRows,
      playbook: input.playbook,
      matrix,
      matchedCluster: cluster,
      reasons,
      governance: {
        state: 'ALLOW',
        confidence: 'LOW',
        sizeMultiplier: 1,
        reasoning: [],
        statisticalConfidence: 0,
        edgeStability: 0,
        advisoryOnly: true
      },
      executionQuality: {
        entryQualityScore: 50,
        executionDiscipline: 50,
        chaseRisk: 'LOW',
        entryTiming: 'IDEAL',
        exitEfficiency: 50,
        managementQuality: 50,
        signalVsExecution: 'UNKNOWN',
        labels: [],
        advisoryOnly: true
      },
      playbookPriorities: { preferred: [], avoid: [], advisoryOnly: true },
      coachSummary: '',
      advisoryOnly: true
    };
  }

  matchCluster(clusters: ConditionCluster[], ctx: LiveExecutionContext): ConditionCluster | null {
    const setup = normalizeSetup(ctx.signalType);
    const regime = normalizeRegime(ctx.marketRegime);
    const rvol = rvolFromContext(ctx);
    const time = timeFromContext(ctx);
    const breadth = breadthFromContext(ctx);

    const candidates = clusters.filter(c => c.setup === setup);
    if (!candidates.length) return null;

    const scored = candidates.map(c => {
      let fit = c.metrics.sampleCount;
      if (c.regime === regime) fit += 40;
      if (c.rvolBucket === rvol) fit += 25;
      if (c.timeWindow === time) fit += 20;
      if (c.breadthBucket === breadth) fit += 15;
      if (c.edgeState === 'HIGH_EDGE') fit += 10;
      if (c.edgeState === 'TOXIC') fit -= 50;
      return { c, fit };
    });

    return scored.sort((a, b) => b.fit - a.fit)[0]?.c ?? null;
  }

  private matchesCluster(c: ConditionCluster, ctx: LiveExecutionContext): boolean {
    const setup = normalizeSetup(ctx.signalType);
    const regime = normalizeRegime(ctx.marketRegime);
    return c.setup === setup && (!c.regime || c.regime === regime);
  }

  private resolveState(input: {
    toxic: boolean;
    cluster: ConditionCluster | null;
    suppressions: SuppressionRule[];
    executionScore: number;
    continuation: ContinuationQualitySnapshot;
    fakeoutLevel: LiveFakeoutRiskLevel;
    openType: OpenTypeSnapshot;
    edgeToday: EdgeTodaySnapshot;
    ctx: LiveExecutionContext;
  }): { state: LiveExecutionGateState; reasons: string[]; headline: string; sublines: string[] } {
    const reasons: string[] = [];
    const sublines: string[] = [];
    let state: LiveExecutionGateState = 'EDGE_ACTIVE';
    let headline = 'Edge active in current conditions';

    const suppressHard = input.suppressions.filter(s => s.severity === 'SUPPRESS');

    if (input.toxic || input.cluster?.edgeState === 'TOXIC') {
      state = 'TOXIC';
      headline = 'Toxic environment detected';
      reasons.push('Matched toxic condition cluster');
      sublines.push('High fakeout environment detected');
    } else if (suppressHard.length >= 2 || (suppressHard.length && input.executionScore < 45)) {
      state = 'NO_EDGE';
      headline = suppressHard[0]?.label ?? 'No edge — conditions suppressed';
      reasons.push(...suppressHard.map(s => s.reason));
    } else if (input.cluster?.edgeState === 'NO_EDGE' || input.cluster?.edgeState === 'WEAK_EDGE') {
      state = 'NO_EDGE';
      headline = `${formatAutonomousOpportunityType(normalizeSetup(input.ctx.signalType))} conditions statistically weak`;
      reasons.push(`Negative expectancy cluster (${input.cluster.metrics.expectancyR.toFixed(2)}R)`);
    } else if (input.fakeoutLevel === 'EXTREME' || input.fakeoutLevel === 'HIGH') {
      state = input.executionScore >= 55 ? 'REDUCE_SIZE' : 'NO_EDGE';
      headline = state === 'REDUCE_SIZE' ? 'Reduce size — elevated fakeout risk' : 'No edge — fakeout environment';
      reasons.push(input.fakeoutLevel + ' fakeout risk');
    } else if (input.continuation.level === 'FAILING' || input.continuation.level === 'WEAK') {
      state = 'REDUCE_SIZE';
      headline = 'Continuation quality weakening';
      reasons.push(`Continuation ${input.continuation.level.toLowerCase()}`);
    } else if (suppressHard.length === 1) {
      state = 'SELECTIVE';
      headline = 'Selective — one suppression active';
      reasons.push(suppressHard[0].reason);
    } else if (input.executionScore >= 72 && input.cluster?.edgeState === 'HIGH_EDGE') {
      state = 'EDGE_ACTIVE';
      headline = `${formatAutonomousOpportunityType(normalizeSetup(input.ctx.signalType))} historically strong in current conditions`;
      if (input.openType.reclaimEnvironment) {
        sublines.push('Reclaim environment favorable');
      }
    } else if (input.executionScore >= 58) {
      state = 'SELECTIVE';
      headline = 'Selective execution — moderate edge quality';
      reasons.push(`Execution score ${input.executionScore}/100`);
    } else if (input.executionScore >= 42) {
      state = 'REDUCE_SIZE';
      headline = 'Reduce size — marginal edge quality';
      reasons.push(`Execution score ${input.executionScore}/100`);
    } else {
      state = 'NO_EDGE';
      headline = 'No edge in current conditions';
      reasons.push(`Execution score ${input.executionScore}/100`);
    }

    if (input.edgeToday.reclaimsWorking && state === 'EDGE_ACTIVE') {
      sublines.push('Reclaims working today');
    }
    if (input.edgeToday.breakoutsWeak) {
      sublines.push('Breakouts failing today');
    }
    if (input.fakeoutLevel === 'LOW' && state !== 'TOXIC') {
      sublines.push('Fakeout risk low');
    }

    return { state, reasons, headline, sublines };
  }

  private buildMatrix(
    ctx: LiveExecutionContext,
    openType: OpenTypeSnapshot,
    continuation: ContinuationQualitySnapshot,
    fakeoutLevel: LiveFakeoutRiskLevel
  ): LiveExecutionMatrixRow[] {
    const regime = normalizeRegime(ctx.marketRegime);
    const breadth = breadthFromContext(ctx);
    const rvol = rvolFromContext(ctx);
    const otStrength = openTypeStrength(openType.openType);

    return [
      {
        condition: 'Regime',
        status: regimeStatus(regime),
        detail: regime
      },
      {
        condition: 'Breadth',
        status: breadth === 'STRONG' ? 'ALIGNED' : breadth === 'WEAK' ? 'WEAK' : 'NEUTRAL',
        detail: breadth
      },
      {
        condition: 'RVOL',
        status: rvolStatus(rvol),
        detail: rvol
      },
      {
        condition: 'Fakeout',
        status: fakeoutMatrixStatus(fakeoutLevel),
        detail: fakeoutLevel
      },
      {
        condition: 'Open Type',
        status: otStrength === 'STRONG' ? 'STRONG' : otStrength === 'WEAK' ? 'WEAK' : 'NEUTRAL',
        detail: openType.label
      },
      {
        condition: 'Continuation',
        status: continuationMatrixStatus(continuation.level),
        detail: continuation.level.replace(/_/g, ' ')
      }
    ];
  }
}

function regimeStatus(regime: string): MatrixConditionStatus {
  if (regime === 'TREND' || regime === 'BREAKOUT') return 'GOOD';
  if (regime === 'CHOP') return 'UNFAVORABLE';
  if (regime === 'CALM') return 'NEUTRAL';
  return 'WEAK';
}

function rvolStatus(rvol: string): MatrixConditionStatus {
  if (rvol === '1.5–3' || rvol === '3–5') return 'FAVORABLE';
  if (rvol === '>5') return 'NEUTRAL';
  return 'WEAK';
}
