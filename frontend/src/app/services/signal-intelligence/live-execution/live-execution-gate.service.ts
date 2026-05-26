import { Injectable } from '@angular/core';
import {
  FalseBreakoutSnapshot,
  OpeningDriveSnapshot,
  SetupRegimeMatrixSnapshot,
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { DailyEdgeDiscoveryReportService } from '../edge-discovery/daily-edge-discovery-report.service';
import { ExecutionEdgeGateResult } from '../edge-discovery/edge-discovery.models';
import { LiveExecutionContext, LiveExecutionGateSnapshot } from './live-execution.models';
import { OpenTypeClassificationEngine } from './open-type-classification.engine';
import { PremarketExtensionAnalyticsEngine } from './premarket-extension-analytics.engine';
import { ContinuationQualityEngine } from './continuation-quality.engine';
import { LiveFakeoutRiskEngine } from './live-fakeout-risk.engine';
import { ExecutionSuppressionEngine } from './execution-suppression.engine';
import { EdgeTodayEngine, startOfSessionTs } from './edge-today.engine';
import { LiveCapitalAllocationEngine } from './live-capital-allocation.engine';
import { ExecutionPlaybookEngine } from './execution-playbook.engine';
import { LiveExecutionGateEngine } from './live-execution-gate.engine';
import {
  ConfidenceWeightedSuppressionEngine,
  governanceLabel,
  mapGovernanceToGateState
} from './confidence-weighted-suppression.engine';
import { ExecutionQualityEngine } from './execution-quality.engine';
import { DailyPlaybookPriorityEngine } from './daily-playbook-priority.engine';
import { ExecutionGovernanceSynthesisEngine } from './execution-governance-synthesis.engine';
import { breadthFromContext, gateLabel, normalizeRegime, normalizeSetup } from './live-execution-context.util';
import { resolveAutonomousOpportunityFromLabel } from '../../../utils/autonomous-terminology.util';

export interface LiveGateInput {
  ctx: LiveExecutionContext;
  falseBreakout: FalseBreakoutSnapshot;
  openingDrive: OpeningDriveSnapshot;
  matrix: SetupRegimeMatrixSnapshot;
  discoveryGate: ExecutionEdgeGateResult | null;
  watchlist?: string[];
  signalAgeMinutes?: number | null;
  extended?: boolean;
}

/** Phase 137/138 orchestrator — live execution filtering + capital governance (advisory only). */
@Injectable({ providedIn: 'root' })
export class LiveExecutionGateService {
  private readonly openTypeEngine = new OpenTypeClassificationEngine();
  private readonly premarketEngine = new PremarketExtensionAnalyticsEngine();
  private readonly continuationEngine = new ContinuationQualityEngine();
  private readonly fakeoutEngine = new LiveFakeoutRiskEngine();
  private readonly suppressionEngine = new ExecutionSuppressionEngine();
  private readonly edgeTodayEngine = new EdgeTodayEngine();
  private readonly capitalEngine = new LiveCapitalAllocationEngine();
  private readonly playbookEngine = new ExecutionPlaybookEngine();
  private readonly gateEngine = new LiveExecutionGateEngine();
  private readonly governanceEngine = new ConfidenceWeightedSuppressionEngine();
  private readonly executionQualityEngine = new ExecutionQualityEngine();
  private readonly playbookPriorityEngine = new DailyPlaybookPriorityEngine();
  private readonly synthesisEngine = new ExecutionGovernanceSynthesisEngine();

  constructor(
    private store: SignalIntelligenceStore,
    private discoveryReport: DailyEdgeDiscoveryReportService
  ) {}

  evaluate(input: LiveGateInput): LiveExecutionGateSnapshot {
    const sym = input.ctx.symbol.toUpperCase();
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const symbolSignals = this.store.query({ symbol: sym, fromTs });
    const todaySignals = this.store.query({ fromTs: startOfSessionTs() });

    const report = this.discoveryReport.snapshot();
    const reportReady = report && report.discovery.totalEvaluated >= 10 ? report : null;
    const premarketHist = this.premarketEngine.analyze(symbolSignals);
    const openType = this.openTypeEngine.classifyLive(input.ctx);
    const premarket = this.premarketEngine.enrichLive(input.ctx, premarketHist);
    const continuation = this.continuationEngine.evaluate(
      input.ctx,
      input.falseBreakout,
      input.openingDrive,
      symbolSignals
    );
    const fakeout = this.fakeoutEngine.evaluate(
      input.ctx,
      input.falseBreakout,
      input.openingDrive,
      openType
    );

    const eliminations = report?.recommendedSuppressions ?? [];
    const suppressions = this.suppressionEngine.evaluate(
      input.ctx,
      openType,
      premarket,
      fakeout.level,
      eliminations
    );

    const edgeToday = this.edgeTodayEngine.analyze(todaySignals);
    const watchlist = (input.watchlist ?? [sym]).map(s => s.toUpperCase());
    const todayBySymbol = new Map<string, typeof todaySignals>();
    for (const s of watchlist) {
      todayBySymbol.set(s, todaySignals.filter(sig => sig.symbol === s));
    }

    const capitalRows = this.capitalEngine.rankWatchlist(
      watchlist,
      report?.symbolRankings ?? [],
      todayBySymbol
    );
    const capitalRank = capitalRows.find(r => r.symbol === sym) ?? null;

    const playbook = this.playbookEngine.build(input.ctx, openType, edgeToday, suppressions);
    const matchedCluster = reportReady
      ? this.gateEngine.matchCluster(reportReady.discovery.clusters, input.ctx)
      : null;

    const setup = normalizeSetup(input.ctx.signalType);
    const regime = normalizeRegime(input.ctx.marketRegime);
    const regimeStable = !input.matrix.unstableCombinations.some(
      u => resolveAutonomousOpportunityFromLabel(u.setup) === setup && u.regime === regime
    );
    const decaySignals = (report?.weakeningEdges ?? []).filter(d =>
      matchedCluster ? d.clusterLabel.includes(matchedCluster.label) : false
    );

    const governance = this.governanceEngine.evaluate({
      ctx: input.ctx,
      cluster: matchedCluster,
      continuation,
      fakeoutRate: input.falseBreakout.falseBreakoutRate,
      regimeStable,
      decaySignals,
      breadthAligned: breadthFromContext(input.ctx) === 'STRONG' || !!input.ctx.regimeAligned,
      timeStability: timeStabilityScore(input.ctx.sessionTimeMinutes ?? 999)
    });

    const executionQuality = this.executionQualityEngine.evaluate({
      ctx: input.ctx,
      signalAgeMinutes: input.signalAgeMinutes,
      extended: input.extended,
      symbolSignals
    });

    const playbookPriorities = this.playbookPriorityEngine.evaluate({
      ctx: input.ctx,
      edgeToday,
      openType,
      continuation,
      fakeoutLevel: fakeout.level,
      report: reportReady
    });

    const coachSummary = this.synthesisEngine.summarize(governance, executionQuality, playbookPriorities);

    const gate = this.gateEngine.evaluate({
      ctx: input.ctx,
      report: reportReady,
      openType,
      premarket,
      continuation,
      fakeoutLevel: fakeout.level,
      fakeoutLabel: fakeout.label,
      edgeToday,
      capitalRank,
      capitalRows,
      playbook,
      suppressions
    });

    const merged = this.mergeGovernance(gate, governance, coachSummary, executionQuality, playbookPriorities);

    if (input.discoveryGate?.state === 'TOXIC' && governance.confidence !== 'LOW') {
      return {
        ...merged,
        state: 'TOXIC',
        label: 'TOXIC',
        headline: 'Toxic environment detected',
        governance: { ...governance, state: 'TOXIC', sizeMultiplier: 0 }
      };
    }

    return merged;
  }

  private mergeGovernance(
    gate: LiveExecutionGateSnapshot,
    governance: import('./live-execution.models').ConfidenceWeightedSuppression,
    coachSummary: string,
    executionQuality: import('./live-execution.models').ExecutionQualitySnapshot,
    playbookPriorities: import('./live-execution.models').DailyPlaybookPrioritySnapshot
  ): LiveExecutionGateSnapshot {
    const govState = mapGovernanceToGateState(governance.state);
    const severityRank = (s: string) =>
      s === 'TOXIC' ? 5 : s === 'NO_EDGE' ? 4 : s === 'REDUCE_SIZE' ? 3 : s === 'SELECTIVE' ? 2 : 1;
    const finalState = severityRank(govState) >= severityRank(gate.state) ? govState : gate.state;

    const headline = governance.reasoning[0] ?? gate.headline;
    const sublines = [
      governanceLabel(governance.state),
      `Stat ${governance.statisticalConfidence}% · Stability ${governance.edgeStability}%`,
      ...gate.sublines.slice(0, 2)
    ];

    return {
      ...gate,
      state: finalState,
      label: gateLabel(finalState),
      headline,
      sublines,
      sizeMultiplier: Math.min(gate.sizeMultiplier, governance.sizeMultiplier),
      governance,
      executionQuality,
      playbookPriorities,
      coachSummary,
      reasons: [...governance.reasoning, ...gate.reasons]
    };
  }
}

function timeStabilityScore(mins: number): number {
  if (mins < 15) return 45;
  if (mins < 45) return 62;
  if (mins < 90) return 78;
  return 85;
}
