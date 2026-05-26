import { Injectable } from '@angular/core';
import { ReplayHistory, ReplaySignalEvent } from '../../models/replay.model';
import { SetupCandidate } from '../../models/execution.model';
import { ExecutionPlan } from '../execution-plan/execution-plan.models';
import { ExecutionPlanBuilderEngine } from '../execution-plan/execution-plan-builder.engine';
import { AutonomousTemplatePlanEngine } from '../autonomous-execution-templates/autonomous-template-plan.engine';
import { HistoricalIndicatorSnapshotEngine } from '../historical-execution/historical-indicator-snapshot.engine';
import { HistoricalRegimeReconstructorEngine } from '../historical-execution/historical-regime-reconstructor.engine';
import { CanonicalExecutionRegime } from '../cluster-family-intelligence/cluster-family.models';
import { ClusterFamilyRegistryService } from '../cluster-family-intelligence/cluster-family-registry.service';
import { formatCanonicalRegimeLabel } from '../cluster-family-intelligence/cluster-family.models';
import { SIGNAL_INTELLIGENCE_LOOKBACK_DAYS } from '../../models/signal-intelligence.model';
import { MarketConditionTag } from '../execution-template-validation/execution-template-validation.models';
import { persistenceContinuationOverride } from '../autonomous-execution-templates/template-calibration.util';
import {
  ClusterExitRow,
  ClusterKind,
  ExitHybridRoutingSuggestion,
  ExitIntelligenceValidationReport,
  ExitLeaderboardRow,
  ExitModeAggregate,
  ExitOutcomeSample,
  ExitPathAnalytics,
  ExitValidationMode,
  ExitValidationProgress,
  RegimeExitComparison
} from './exit-intelligence-validation.models';
import { analyzeExitPath, planExitFields } from './exit-path-analytics.engine';

const BEARISH = new Set(['OPEN_FAIL', 'OPEN_FAIL_BREAK', 'RECOVERY_FAIL', 'IMBALANCE_DOWN']);
const ALL_REGIMES: CanonicalExecutionRegime[] = [
  'EARLY_EXPANSION',
  'INSTITUTIONAL_PERSISTENCE',
  'VWAP_ACCEPTANCE',
  'SHALLOW_PULLBACK_CONTINUATION',
  'COMPRESSION_BREAKOUT',
  'HEALTHY_EXTENSION',
  'EXHAUSTION_DRIFT',
  'PERSISTENT_CONTINUATION'
];

const MIN_EVENTS = 200;

@Injectable({ providedIn: 'root' })
export class ExitIntelligenceValidationEngine {
  private readonly indicators = new HistoricalIndicatorSnapshotEngine();
  private readonly regimeEngine = new HistoricalRegimeReconstructorEngine();

  constructor(
    private readonly legacyBuilder: ExecutionPlanBuilderEngine,
    private readonly autonomousBuilder: AutonomousTemplatePlanEngine,
    private readonly clusterRegistry: ClusterFamilyRegistryService
  ) {}

  run(
    sessionsBySymbol: Map<string, ReplayHistory[]>,
    onProgress?: (p: ExitValidationProgress) => void
  ): ExitIntelligenceValidationReport {
    const samples: ExitOutcomeSample[] = [];
    let sessionsScanned = 0;
    const symbols = [...sessionsBySymbol.keys()];
    const total = symbols.reduce((n, s) => n + (sessionsBySymbol.get(s)?.length ?? 0), 0);
    let done = 0;

    for (const symbol of symbols) {
      for (const session of sessionsBySymbol.get(symbol) ?? []) {
        sessionsScanned++;
        done++;
        onProgress?.({ phase: `Exit analysis ${symbol} ${session.replayDate}`, done, total });
        const tags = classifySession(session);
        for (const event of session.timeline ?? []) {
          const rows = this.evaluateEvent(symbol, session, event, tags);
          if (rows?.length) samples.push(...rows);
        }
      }
    }

    return buildReport(samples, sessionsScanned, symbols.length, SIGNAL_INTELLIGENCE_LOOKBACK_DAYS);
  }

  private evaluateEvent(
    symbol: string,
    session: ReplayHistory,
    event: ReplaySignalEvent,
    marketTags: MarketConditionTag[]
  ): ExitOutcomeSample[] | null {
    const candles = session.sessionCandles;
    if (!candles?.length) return null;

    const barIndex = barIndexForEvent(candles, event.timestamp);
    if (barIndex < 0) return null;

    const ind = this.indicators.build(candles, barIndex);
    if (!ind) return null;

    const c = candles[barIndex];
    const price = event.price ?? c.close;
    const source: SetupCandidate = {
      symbol,
      signalType: event.signalType,
      price,
      relativeVolume: event.rvol ?? ind.relativeVolume,
      extended: event.extended,
      freshness: 'ACTIVE'
    };

    const ctx = {
      source,
      price,
      indicators: ind,
      snapshot: null,
      extended: event.extended,
      replayTimestamp: c.time
    };

    const legacyPlan = this.legacyBuilder.build({ ...ctx, planSource: 'LEGACY_RR' }).plan;
    const autoPlan = this.autonomousBuilder.build({ ...ctx, planSource: 'AUTONOMOUS_TEMPLATE' }).plan;
    const regime: CanonicalExecutionRegime = this.regimeEngine.fromSignal(event)
      ?? (autoPlan?.canonicalRegime as CanonicalExecutionRegime | undefined)
      ?? 'INSTITUTIONAL_PERSISTENCE';

    const hybridPlan = buildHybridExitPlan(legacyPlan, autoPlan, regime);
    const clusterMeta = resolveClusterMeta(autoPlan, regime, this.clusterRegistry);

    const direction = (autoPlan?.direction ?? legacyPlan?.direction) === 'SHORT' ? 'SHORT' : 'LONG';
    const entry = (autoPlan ?? legacyPlan)?.entryZone.ideal ?? (autoPlan ?? legacyPlan)?.entryZone.low;
    const stop = (autoPlan ?? legacyPlan)?.stopZone.price;
    if (entry == null || stop == null) return null;

    const plans: [ExitValidationMode, ExecutionPlan | null][] = [
      ['LEGACY_RR', legacyPlan],
      ['AUTONOMOUS_TEMPLATE', autoPlan],
      ['HYBRID', hybridPlan]
    ];

    const out: ExitOutcomeSample[] = [];
    for (const [mode, plan] of plans) {
      const sample = this.planToExitSample(
        mode,
        plan,
        symbol,
        session.replayDate,
        regime,
        clusterMeta,
        marketTags,
        event,
        candles,
        barIndex,
        direction,
        entry,
        stop,
        ind.relativeVolume,
        ind.vwap
      );
      if (sample) out.push(sample);
    }
    return out.length ? out : null;
  }

  private planToExitSample(
    mode: ExitValidationMode,
    plan: ExecutionPlan | null,
    symbol: string,
    sessionDate: string,
    regime: CanonicalExecutionRegime,
    clusterMeta: { clusterId: string; clusterLabel: string; clusterKind: ClusterKind },
    marketTags: MarketConditionTag[],
    event: ReplaySignalEvent,
    candles: ReplayHistory['sessionCandles'],
    barIndex: number,
    direction: 'LONG' | 'SHORT',
    entry: number,
    stop: number,
    relativeVolume: number,
    vwap: number
  ): ExitOutcomeSample | null {
    if (!plan) return null;
    if (regime === 'EXHAUSTION_DRIFT' && mode === 'AUTONOMOUS_TEMPLATE' && entry === stop) {
      return null;
    }

    const target = plan.targetZone.primary;
    const fields = planExitFields(plan);
    const path = analyzeExitPath({
      direction,
      entry,
      stop,
      target,
      candles,
      startIdx: barIndex,
      planPersistence: fields.persistence,
      planExhaustion: fields.exhaustion,
      vwap
    });
    if (!path) return null;

    const holdOverride = persistenceContinuationOverride({
      price: entry,
      conviction: plan.conviction ?? 55,
      expansionProbability: plan.expansionProbability ?? 55,
      continuationPersistence: fields.persistence,
      exhaustionProbability: fields.exhaustion,
      triggerIntegrity: 52,
      institutionalPressure: fields.persistence,
      executionQuality: 50,
      relativeVolume,
      extended: false
    });
    if (holdOverride && path.missedMfeR >= 0.5) {
      path.persistenceOverrideWouldHelp = true;
    }

    return {
      mode,
      symbol,
      sessionDate,
      regime,
      clusterId: clusterMeta.clusterId,
      clusterLabel: clusterMeta.clusterLabel,
      clusterKind: clusterMeta.clusterKind,
      marketTags,
      signalType: event.signalType,
      extended: event.extended,
      plannedRr: plan.riskReward ?? null,
      planPersistence: fields.persistence,
      planExhaustion: fields.exhaustion,
      exitLabel: fields.exitLabel,
      path
    };
  }
}

function resolveClusterMeta(
  plan: ExecutionPlan | null,
  regime: CanonicalExecutionRegime,
  registry: ClusterFamilyRegistryService
): { clusterId: string; clusterLabel: string; clusterKind: ClusterKind } {
  const snap = registry.snapshot();
  const rawId = plan?.clusterId;
  if (rawId && snap?.entries.some(e => e.clusterId === rawId)) {
    const ent = snap.entries.find(e => e.clusterId === rawId)!;
    return { clusterId: rawId, clusterLabel: ent.clusterName, clusterKind: 'RAW_CLUSTER' };
  }
  return {
    clusterId: regime,
    clusterLabel: formatCanonicalRegimeLabel(regime),
    clusterKind: 'CANONICAL'
  };
}

function buildHybridExitPlan(
  legacy: ExecutionPlan | null,
  auto: ExecutionPlan | null,
  regime: CanonicalExecutionRegime
): ExecutionPlan | null {
  if (!auto && !legacy) return null;
  if (!auto) return legacy;
  if (!legacy) return auto;

  const legT = legacy.targetZone.primary;
  const autoT = auto.targetZone.primary;
  const widenRegimes = new Set<CanonicalExecutionRegime>([
    'INSTITUTIONAL_PERSISTENCE',
    'EARLY_EXPANSION',
    'PERSISTENT_CONTINUATION',
    'VWAP_ACCEPTANCE'
  ]);

  let primary = autoT;
  if (widenRegimes.has(regime) && legT != null && autoT != null) {
    primary = Math.max(legT, autoT);
  } else if (regime === 'HEALTHY_EXTENSION' || regime === 'EXHAUSTION_DRIFT') {
    primary = autoT ?? legT;
  } else if (legT != null && autoT != null) {
    primary = (legT + autoT) / 2;
  }

  return {
    ...auto,
    targetZone: { ...auto.targetZone, primary, trailing: auto.targetZone.trailing ?? legacy.targetZone.trailing },
    guidance: {
      ...auto.guidance,
      exitLabel: auto.guidance.exitLabel ?? legacy.guidance.exitLabel
    }
  };
}

function barIndexForEvent(candles: ReplayHistory['sessionCandles'], timestamp: string): number {
  const t = new Date(timestamp).getTime();
  let best = -1;
  let bestDt = Infinity;
  for (let i = 0; i < candles.length; i++) {
    const dt = Math.abs(new Date(candles[i].time).getTime() - t);
    if (dt < bestDt) {
      bestDt = dt;
      best = i;
    }
  }
  return bestDt < 120_000 ? best : -1;
}

function classifySession(session: ReplayHistory): MarketConditionTag[] {
  const tags: MarketConditionTag[] = [];
  const candles = session.sessionCandles;
  if (!candles.length) return tags;
  const open = candles[0].open;
  const close = candles[candles.length - 1].close;
  const sessionMove = Math.abs(close - open) / Math.max(open, 0.01);
  const ranges = candles.map(c => (c.high - c.low) / Math.max(c.close, 0.01));
  const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  if (sessionMove >= 0.012 && close > open) tags.push('STRONG_TREND');
  if (avgRange >= 0.006) tags.push('HIGH_VOLATILITY');
  if (avgRange <= 0.0025) tags.push('LOW_VOLATILITY');
  const openBars = candles.slice(0, Math.min(6, candles.length));
  if (openBars.reduce((m, c) => Math.max(m, (c.high - c.low) / c.close), 0) >= 0.004) {
    tags.push('OPENING_DRIVE');
  }
  const failN = (session.timeline ?? []).filter(e =>
    (e.signalType ?? '').includes('FAIL') || (e.signalType ?? '').includes('EXHAUST')
  ).length;
  if (failN >= 3) tags.push('EXHAUSTION_DAY');
  if ((session.timeline?.length ?? 0) >= 8 && sessionMove < 0.006) tags.push('CHOP');
  return tags;
}

function aggregateExitMode(mode: ExitValidationMode, rows: ExitOutcomeSample[]): ExitModeAggregate {
  const n = rows.length;
  if (!n) return emptyAggregate(mode);
  const avg = (fn: (p: ExitPathAnalytics) => number) =>
    Math.round(rows.reduce((s, r) => s + fn(r.path), 0) / n * 10) / 10;
  const pct = (fn: (p: ExitPathAnalytics) => boolean) =>
    Math.round(rows.filter(r => fn(r.path)).length / n * 1000) / 10;

  const avgMissed = avg(p => p.missedMfePct);
  const avgRetained = avg(p => p.retainedMfePct);
  const exitQualityScore = Math.round(Math.min(100, Math.max(0,
    avgRetained * 0.35
    + (100 - avgMissed) * 0.25
    + pct(p => p.postExitContinuationPct) * 0.2
    + pct(p => p.targetHit) * 0.1
    - pct(p => p.falseExhaustion) * 0.15
    - pct(p => p.earlyTrim) * 0.1
  )));

  return {
    mode,
    sampleCount: n,
    exitQualityScore,
    avgRetainedMfePct: avgRetained,
    avgMissedMfePct: avgMissed,
    postExitContinuationPct: pct(p => p.postExitContinuationPct),
    avgPostExitBars: avg(p => p.postExitBars),
    secondLegCapturePct: pct(p => p.secondLegCaptured),
    falseExhaustionPct: pct(p => p.falseExhaustion),
    exhaustionWhilePersistencePct: pct(p => p.exhaustionWhilePersistence),
    targetEfficiencyPct: pct(p => p.targetHit),
    overTightTargetPct: pct(p => p.overTightTarget),
    underExtendedTargetPct: pct(p => p.underExtendedTarget),
    earlyTrimPct: pct(p => p.earlyTrim),
    avgExitToPeakDistanceR: avg(p => p.exitToPeakDistanceR),
    persistenceOverrideSavedPct: pct(p => p.persistenceOverrideWouldHelp),
    expectancyProxy: avg(p => p.exitR)
  };
}

function emptyAggregate(mode: ExitValidationMode): ExitModeAggregate {
  return {
    mode,
    sampleCount: 0,
    exitQualityScore: 0,
    avgRetainedMfePct: 0,
    avgMissedMfePct: 0,
    postExitContinuationPct: 0,
    avgPostExitBars: 0,
    secondLegCapturePct: 0,
    falseExhaustionPct: 0,
    exhaustionWhilePersistencePct: 0,
    targetEfficiencyPct: 0,
    overTightTargetPct: 0,
    underExtendedTargetPct: 0,
    earlyTrimPct: 0,
    avgExitToPeakDistanceR: 0,
    persistenceOverrideSavedPct: 0,
    expectancyProxy: 0
  };
}

function buildReport(
  samples: ExitOutcomeSample[],
  sessionsScanned: number,
  symbolsScanned: number,
  lookbackDays: number
): ExitIntelligenceValidationReport {
  const eventsEvaluated = samples.length / 3;
  const legacy = aggregateExitMode('LEGACY_RR', samples.filter(s => s.mode === 'LEGACY_RR'));
  const autonomous = aggregateExitMode('AUTONOMOUS_TEMPLATE', samples.filter(s => s.mode === 'AUTONOMOUS_TEMPLATE'));
  const hybrid = aggregateExitMode('HYBRID', samples.filter(s => s.mode === 'HYBRID'));

  const delta = autonomous.exitQualityScore - legacy.exitQualityScore;
  const overallWinner: ExitValidationMode | 'TIE' =
    legacy.sampleCount < 20 || Math.abs(delta) < 4
      ? 'TIE'
      : delta > 0
        ? 'AUTONOMOUS_TEMPLATE'
        : 'LEGACY_RR';

  const regimeComparisons: RegimeExitComparison[] = ALL_REGIMES.map(regime => {
    const leg = aggregateExitMode('LEGACY_RR', samples.filter(s => s.regime === regime && s.mode === 'LEGACY_RR'));
    const aut = aggregateExitMode('AUTONOMOUS_TEMPLATE', samples.filter(s => s.regime === regime && s.mode === 'AUTONOMOUS_TEMPLATE'));
    const hyb = aggregateExitMode('HYBRID', samples.filter(s => s.regime === regime && s.mode === 'HYBRID'));
    const d = aut.exitQualityScore - leg.exitQualityScore;
    const winner: ExitValidationMode | 'TIE' =
      leg.sampleCount < 6 ? 'TIE' : d > 3 ? 'AUTONOMOUS_TEMPLATE' : d < -3 ? 'LEGACY_RR' : 'TIE';
    return {
      regime,
      legacy: leg,
      autonomous: aut,
      hybrid: hyb,
      winner,
      exitQualityDelta: d,
      sampleCount: Math.max(leg.sampleCount, aut.sampleCount)
    };
  }).filter(r => r.sampleCount > 0);

  const clusterKeys = new Map<string, ExitOutcomeSample[]>();
  for (const s of samples) {
    const key = `${s.clusterId}|${s.mode}`;
    clusterKeys.set(key, [...(clusterKeys.get(key) ?? []), s]);
  }
  const clusterRows: ClusterExitRow[] = [];
  for (const [key, rows] of clusterKeys) {
    if (rows.length < 4) continue;
    const [clusterId, mode] = key.split('|') as [string, ExitValidationMode];
    clusterRows.push({
      clusterId,
      clusterLabel: rows[0].clusterLabel,
      clusterKind: rows[0].clusterKind,
      canonicalRegime: rows[0].regime,
      mode,
      aggregate: aggregateExitMode(mode, rows)
    });
  }

  const insufficientSample = eventsEvaluated < MIN_EVENTS || symbolsScanned < 3;
  const warnings: string[] = [];
  if (insufficientSample) warnings.push(`Low sample: ~${Math.round(eventsEvaluated)} events — exit attribution indicative only`);

  const hybridRoutingSuggestions = buildExitHybridSuggestions(regimeComparisons);

  return {
    advisoryOnly: true,
    researchOnly: true,
    generatedAt: Date.now(),
    lookbackDays,
    sessionsScanned,
    eventsEvaluated: Math.round(eventsEvaluated),
    symbolsScanned,
    clustersEvaluated: new Set(samples.map(s => s.clusterId)).size,
    overallExitQualityScore: Math.round((legacy.exitQualityScore + autonomous.exitQualityScore + hybrid.exitQualityScore) / 3),
    overallLegacy: legacy,
    overallAutonomous: autonomous,
    overallHybrid: hybrid,
    overallWinner,
    regimeComparisons,
    clusterRows: clusterRows.sort((a, b) => b.aggregate.exitQualityScore - a.aggregate.exitQualityScore).slice(0, 40),
    bestExitRegimes: leaderboard(regimeComparisons, 'best'),
    worstExitRegimes: leaderboard(regimeComparisons, 'worst'),
    mostPrematureExits: prematureLeaderboard(regimeComparisons),
    mostUnderCapturedContinuations: underCaptureLeaderboard(regimeComparisons),
    bestSecondLegHolders: secondLegLeaderboard(regimeComparisons),
    falseExhaustionLeaderboard: falseExhaustLeaderboard(regimeComparisons),
    persistenceOverrideSavedRanking: persistenceSavedLeaderboard(regimeComparisons),
    topClustersNeedingTargetExtension: targetExtensionLeaderboard(clusterRows),
    hybridRoutingSuggestions,
    summaryInsights: buildInsights(legacy, autonomous, hybrid, overallWinner, insufficientSample),
    insufficientSample,
    validationWarnings: warnings
  };
}

function leaderboard(rows: RegimeExitComparison[], kind: 'best' | 'worst'): ExitLeaderboardRow[] {
  const sorted = [...rows].sort((a, b) =>
    kind === 'best'
      ? b.autonomous.exitQualityScore - a.autonomous.exitQualityScore
      : a.autonomous.exitQualityScore - b.autonomous.exitQualityScore
  );
  return sorted.slice(0, 5).map(r => ({
    label: r.regime.replace(/_/g, ' '),
    score: r.autonomous.exitQualityScore,
    sampleCount: r.sampleCount,
    detail: `Missed MFE ${r.autonomous.avgMissedMfePct}% · post-exit cont ${r.autonomous.postExitContinuationPct}%`
  }));
}

function prematureLeaderboard(rows: RegimeExitComparison[]): ExitLeaderboardRow[] {
  return [...rows]
    .sort((a, b) => b.autonomous.earlyTrimPct - a.autonomous.earlyTrimPct)
    .slice(0, 5)
    .map(r => ({
      label: r.regime.replace(/_/g, ' '),
      score: r.autonomous.earlyTrimPct,
      sampleCount: r.sampleCount,
      detail: `Early trim ${r.autonomous.earlyTrimPct}% · false exhaust ${r.autonomous.falseExhaustionPct}%`
    }));
}

function underCaptureLeaderboard(rows: RegimeExitComparison[]): ExitLeaderboardRow[] {
  return [...rows]
    .sort((a, b) => b.autonomous.avgMissedMfePct - a.autonomous.avgMissedMfePct)
    .slice(0, 5)
    .map(r => ({
      label: r.regime.replace(/_/g, ' '),
      score: r.autonomous.avgMissedMfePct,
      sampleCount: r.sampleCount,
      detail: `Under-extended ${r.autonomous.underExtendedTargetPct}% · retained ${r.autonomous.avgRetainedMfePct}%`
    }));
}

function secondLegLeaderboard(rows: RegimeExitComparison[]): ExitLeaderboardRow[] {
  return [...rows]
    .sort((a, b) => b.autonomous.secondLegCapturePct - a.autonomous.secondLegCapturePct)
    .slice(0, 5)
    .map(r => ({
      label: r.regime.replace(/_/g, ' '),
      score: r.autonomous.secondLegCapturePct,
      sampleCount: r.sampleCount,
      detail: `Post-exit bars ${r.autonomous.avgPostExitBars}`
    }));
}

function falseExhaustLeaderboard(rows: RegimeExitComparison[]): ExitLeaderboardRow[] {
  return [...rows]
    .sort((a, b) => b.autonomous.falseExhaustionPct - a.autonomous.falseExhaustionPct)
    .slice(0, 5)
    .map(r => ({
      label: r.regime.replace(/_/g, ' '),
      score: r.autonomous.falseExhaustionPct,
      sampleCount: r.sampleCount,
      detail: `Exhaust+persist ${r.autonomous.exhaustionWhilePersistencePct}%`
    }));
}

function persistenceSavedLeaderboard(rows: RegimeExitComparison[]): ExitLeaderboardRow[] {
  return [...rows]
    .sort((a, b) => b.autonomous.persistenceOverrideSavedPct - a.autonomous.persistenceOverrideSavedPct)
    .slice(0, 5)
    .map(r => ({
      label: r.regime.replace(/_/g, ' '),
      score: r.autonomous.persistenceOverrideSavedPct,
      sampleCount: r.sampleCount,
      detail: `Hybrid score ${r.hybrid.exitQualityScore} vs auto ${r.autonomous.exitQualityScore}`
    }));
}

function targetExtensionLeaderboard(rows: ClusterExitRow[]): ExitLeaderboardRow[] {
  return [...rows]
    .filter(r => r.mode === 'AUTONOMOUS_TEMPLATE')
    .sort((a, b) => b.aggregate.underExtendedTargetPct + b.aggregate.avgMissedMfePct
      - (a.aggregate.underExtendedTargetPct + a.aggregate.avgMissedMfePct))
    .slice(0, 8)
    .map(r => ({
      label: r.clusterLabel,
      score: r.aggregate.avgMissedMfePct,
      sampleCount: r.aggregate.sampleCount,
      detail: `Under-ext ${r.aggregate.underExtendedTargetPct}% · over-tight ${r.aggregate.overTightTargetPct}%`
    }));
}

function buildExitHybridSuggestions(rows: RegimeExitComparison[]): ExitHybridRoutingSuggestion[] {
  const out: ExitHybridRoutingSuggestion[] = [];
  for (const r of rows) {
    if (r.sampleCount < 6) continue;
    let entrySource = 'autonomous entry';
    let exitStrategy = 'autonomous exit';
    let targetStrategy = 'autonomous target';
    let persistenceOverride = false;
    let reason = '';

    switch (r.regime) {
      case 'EARLY_EXPANSION':
        exitStrategy = 'delayed exhaustion';
        targetStrategy = 'trailing continuation hold';
        persistenceOverride = true;
        reason = 'High missed MFE / post-exit continuation — delay exhaustion trim';
        break;
      case 'INSTITUTIONAL_PERSISTENCE':
        targetStrategy = 'legacy target extension';
        persistenceOverride = true;
        exitStrategy = 'autonomous hold';
        reason = 'Persistence monetization — widen targets, override mild exhaustion';
        break;
      case 'HEALTHY_EXTENSION':
        exitStrategy = 'earlier trims';
        targetStrategy = 'smaller targets';
        reason = 'Late extension risk — tighten targets and invalidation';
        break;
      case 'EXHAUSTION_DRIFT':
        exitStrategy = 'exit priority';
        targetStrategy = 'de-risk only';
        reason = 'Exhaustion cluster — avoid continuation hold';
        break;
      case 'SHALLOW_PULLBACK_CONTINUATION':
        targetStrategy = 'hybrid wider target';
        persistenceOverride = r.autonomous.persistenceOverrideSavedPct > 15;
        reason = 'Shallow PB — hybrid target + persistence-aware hold';
        break;
      default:
        if (r.autonomous.avgMissedMfePct > r.legacy.avgMissedMfePct + 8) {
          targetStrategy = 'hybrid max(legacy, auto) target';
          reason = 'Autonomous exits leave continuation on table vs legacy';
        } else {
          reason = 'Balanced — keep hybrid routing under observation';
        }
    }

    out.push({
      regime: r.regime,
      entrySource,
      exitStrategy,
      targetStrategy,
      persistenceOverride,
      reason
    });
  }
  return out;
}

function buildInsights(
  leg: ExitModeAggregate,
  aut: ExitModeAggregate,
  hyb: ExitModeAggregate,
  winner: ExitValidationMode | 'TIE',
  insufficient: boolean
): string[] {
  const lines: string[] = [
    'Phase 180 — exit/target intelligence validation (research only; no execution changes).',
    insufficient
      ? 'Sample below threshold — treat rankings as directional.'
      : `Analyzed exit quality: legacy ${leg.exitQualityScore} · autonomous ${aut.exitQualityScore} · hybrid ${hyb.exitQualityScore}.`
  ];
  if (aut.avgMissedMfePct > leg.avgMissedMfePct + 5) {
    lines.push('Autonomous exits show higher missed MFE — target extension / trailing hold research warranted.');
  }
  if (aut.falseExhaustionPct > leg.falseExhaustionPct + 5) {
    lines.push('False exhaustion rate elevated on autonomous template — delay exhaustion triggers on persistence regimes.');
  }
  if (hyb.exitQualityScore > aut.exitQualityScore + 2) {
    lines.push('Hybrid exit routing improves capture vs pure autonomous — regime-specific target blending likely optimal.');
  }
  lines.push(winner === 'LEGACY_RR'
    ? 'Legacy RR still leads exit quality score — autonomous exits not ready to replace legacy targets.'
    : winner === 'AUTONOMOUS_TEMPLATE'
      ? 'Autonomous template leads exit quality — continue validation before default switch.'
      : 'Exit modes tied — hybrid regime routing recommended.');
  return lines;
}
