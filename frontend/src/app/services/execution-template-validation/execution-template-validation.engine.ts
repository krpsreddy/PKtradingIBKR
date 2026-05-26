import { Injectable } from '@angular/core';
import { ReplayHistory, ReplaySignalEvent } from '../../models/replay.model';
import { SetupCandidate } from '../../models/execution.model';
import { ExecutionPlan } from '../execution-plan/execution-plan.models';
import { ExecutionPlanBuilderEngine } from '../execution-plan/execution-plan-builder.engine';
import { AutonomousTemplatePlanEngine } from '../autonomous-execution-templates/autonomous-template-plan.engine';
import { HistoricalIndicatorSnapshotEngine } from '../historical-execution/historical-indicator-snapshot.engine';
import { HistoricalRegimeReconstructorEngine } from '../historical-execution/historical-regime-reconstructor.engine';
import { SignalEvaluationEngine } from '../signal-intelligence/signal-evaluation.engine';
import { CanonicalExecutionRegime } from '../cluster-family-intelligence/cluster-family.models';
import { SIGNAL_INTELLIGENCE_LOOKBACK_DAYS } from '../../models/signal-intelligence.model';
import {
  DefaultModeRecommendation,
  ExecutionTemplateValidationReport,
  HybridRegimeRouting,
  MarketConditionTag,
  PlanOutcomeSample,
  RegimeModeComparison,
  TemplateReadinessStatus,
  VALIDATION_MIN_EVENTS,
  VALIDATION_MIN_REGIMES,
  VALIDATION_MIN_SYMBOLS,
  ValidationFailureMode,
  ValidationPlanMode,
  ValidationProgress
} from './execution-template-validation.models';
import {
  aggregateModeMetrics,
  confidenceLevel,
  mfeCapturePct,
  realizedR
} from './execution-template-validation-metrics.util';

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

@Injectable({ providedIn: 'root' })
export class ExecutionTemplateValidationEngine {
  private readonly indicators = new HistoricalIndicatorSnapshotEngine();
  private readonly regimeEngine = new HistoricalRegimeReconstructorEngine();
  private readonly evaluator = new SignalEvaluationEngine();

  constructor(
    private readonly legacyBuilder: ExecutionPlanBuilderEngine,
    private readonly autonomousBuilder: AutonomousTemplatePlanEngine
  ) {}

  run(
    sessionsBySymbol: Map<string, ReplayHistory[]>,
    onProgress?: (p: ValidationProgress) => void
  ): ExecutionTemplateValidationReport {
    const samples: PlanOutcomeSample[] = [];
    let sessionsScanned = 0;
    let eventsTotal = 0;
    const symbols = [...sessionsBySymbol.keys()];
    let done = 0;
    const total = symbols.reduce((n, sym) => n + (sessionsBySymbol.get(sym)?.length ?? 0), 0);

    for (const symbol of symbols) {
      for (const session of sessionsBySymbol.get(symbol) ?? []) {
        sessionsScanned++;
        done++;
        onProgress?.({ phase: `Evaluating ${symbol} ${session.replayDate}`, done, total });
        const tags = classifySession(session);
        for (const event of session.timeline ?? []) {
          const row = evaluateEvent(symbol, session, event, tags, {
            legacyBuilder: this.legacyBuilder,
            autonomousBuilder: this.autonomousBuilder,
            indicators: this.indicators,
            regimeEngine: this.regimeEngine,
            evaluator: this.evaluator
          });
          if (row) {
            samples.push(...row);
            eventsTotal++;
          }
        }
      }
    }

    return buildReport(samples, sessionsScanned, eventsTotal, symbols.length, SIGNAL_INTELLIGENCE_LOOKBACK_DAYS);
  }
}

function evaluateEvent(
  symbol: string,
  session: ReplayHistory,
  event: ReplaySignalEvent,
  marketTags: MarketConditionTag[],
  deps: {
    legacyBuilder: ExecutionPlanBuilderEngine;
    autonomousBuilder: AutonomousTemplatePlanEngine;
    indicators: HistoricalIndicatorSnapshotEngine;
    regimeEngine: HistoricalRegimeReconstructorEngine;
    evaluator: SignalEvaluationEngine;
  }
): PlanOutcomeSample[] | null {
  const candles = session.sessionCandles;
  if (!candles?.length) return null;

  const barIndex = barIndexForEvent(candles, event.timestamp);
  if (barIndex < 0) return null;

  const ind = deps.indicators.build(candles, barIndex);
  if (!ind) return null;

  const c = candles[barIndex];
  const price = event.price ?? c.close;
  const bullish = !BEARISH.has(event.signalType);
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

  const legacyPlan = deps.legacyBuilder.build({ ...ctx, planSource: 'LEGACY_RR' }).plan;
  const autoPlan = deps.autonomousBuilder.build({ ...ctx, planSource: 'AUTONOMOUS_TEMPLATE' }).plan;
  const regime: CanonicalExecutionRegime = deps.regimeEngine.fromSignal(event)
    ?? (autoPlan?.canonicalRegime as CanonicalExecutionRegime | undefined)
    ?? 'INSTITUTIONAL_PERSISTENCE';

  const ts = new Date(event.timestamp).getTime();
  const out: PlanOutcomeSample[] = [];

  for (const [mode, plan] of [
    ['LEGACY_RR', legacyPlan],
    ['AUTONOMOUS_TEMPLATE', autoPlan]
  ] as const) {
    const sample = planToSample(mode, plan, symbol, session.replayDate, regime, marketTags, event, candles, ts, deps.evaluator);
    if (sample) out.push(sample);
  }
  return out.length ? out : null;
}

function planToSample(
  mode: ValidationPlanMode,
  plan: ExecutionPlan | null,
  symbol: string,
  sessionDate: string,
  regime: CanonicalExecutionRegime,
  marketTags: MarketConditionTag[],
  event: ReplaySignalEvent,
  candles: ReplayHistory['sessionCandles'],
  signalTs: number,
  evaluator: SignalEvaluationEngine
): PlanOutcomeSample | null {
  if (!plan) return null;
  const entry = plan.entryZone.ideal ?? plan.entryZone.low;
  const stop = plan.stopZone.price;
  const target = plan.targetZone.primary;
  const direction = plan.direction === 'SHORT' ? 'SHORT' : 'LONG';

  if (regime === 'EXHAUSTION_DRIFT' && mode === 'AUTONOMOUS_TEMPLATE' && entry === stop) {
    // no-entry template — skip trade evaluation
    return null;
  }

  const evaluation = evaluator.evaluate({
    direction,
    entryPrice: entry,
    stopPrice: stop,
    targetPrice: target,
    signalTimestamp: signalTs,
    candles
  });

  if (!evaluation.evaluated) return null;

  const plannedRr = plan.riskReward ?? null;
  const addLevels = plan.addLevels ?? [];
  const addHit = addLevels.some(lvl =>
    direction === 'LONG'
      ? candles.some(c => c.high >= lvl)
      : candles.some(c => c.low <= lvl)
  );

  return {
    mode,
    symbol,
    sessionDate,
    regime,
    marketTags,
    signalType: event.signalType,
    extended: event.extended,
    evaluation,
    plannedRr,
    mfeCapturePct: mfeCapturePct(evaluation, plannedRr),
    addHit
  };
}

function barIndexForEvent(candles: ReplayHistory['sessionCandles'], timestamp: string): number {
  const t = new Date(timestamp).getTime();
  let best = -1;
  let bestDt = Infinity;
  for (let i = 0; i < candles.length; i++) {
    const ct = new Date(candles[i].time).getTime();
    const dt = Math.abs(ct - t);
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
  const openRange = openBars.reduce((m, c) => Math.max(m, (c.high - c.low) / c.close), 0);
  if (openRange >= 0.004) tags.push('OPENING_DRIVE');

  const failN = (session.timeline ?? []).filter(e =>
    (e.signalType ?? '').includes('FAIL') || (e.signalType ?? '').includes('EXHAUST')
  ).length;
  if (failN >= 3) tags.push('EXHAUSTION_DAY');

  const signalN = session.timeline?.length ?? 0;
  if (signalN >= 8 && sessionMove < 0.006) tags.push('CHOP');
  if (signalN >= 4 && sessionMove < 0.004) tags.push('WEAK_BREADTH');

  const afternoon = (session.timeline ?? []).filter(e => {
    const h = new Date(e.timestamp).getUTCHours();
    return h >= 18 && h <= 21;
  });
  if (afternoon.length >= 2) tags.push('AFTERNOON_CONTINUATION');

  return tags;
}

function buildReport(
  samples: PlanOutcomeSample[],
  sessionsScanned: number,
  eventsEvaluated: number,
  symbolsScanned: number,
  lookbackDays: number
): ExecutionTemplateValidationReport {
  const legacySamples = samples.filter(s => s.mode === 'LEGACY_RR');
  const autoSamples = samples.filter(s => s.mode === 'AUTONOMOUS_TEMPLATE');

  const overallLegacy = aggregateModeMetrics('LEGACY_RR', samples);
  const overallAutonomous = aggregateModeMetrics('AUTONOMOUS_TEMPLATE', samples);
  const delta = overallAutonomous.expectancy - overallLegacy.expectancy;
  const overallWinner = winnerMode(overallLegacy, overallAutonomous, delta);

  const regimeComparisons: RegimeModeComparison[] = ALL_REGIMES.map(regime => {
    const leg = aggregateModeMetrics('LEGACY_RR', legacySamples.filter(s => s.regime === regime));
    const aut = aggregateModeMetrics('AUTONOMOUS_TEMPLATE', autoSamples.filter(s => s.regime === regime));
    const d = aut.expectancy - leg.expectancy;
    return {
      regime,
      legacy: leg,
      autonomous: aut,
      winner: leg.sampleCount < 8 || aut.sampleCount < 8 ? 'TIE' : winnerMode(leg, aut, d),
      expectancyDelta: Math.round(d * 1000) / 1000,
      sampleCount: Math.max(leg.sampleCount, aut.sampleCount)
    };
  }).filter(r => r.sampleCount > 0);

  const marketTags = new Set<MarketConditionTag>();
  for (const s of samples) s.marketTags.forEach(t => marketTags.add(t));

  const marketComparisons = [...marketTags].map(tag => {
    const leg = aggregateModeMetrics('LEGACY_RR', legacySamples.filter(s => s.marketTags.includes(tag)));
    const aut = aggregateModeMetrics('AUTONOMOUS_TEMPLATE', autoSamples.filter(s => s.marketTags.includes(tag)));
    const d = aut.expectancy - leg.expectancy;
    return {
      tag,
      legacy: leg,
      autonomous: aut,
      winner: leg.sampleCount < 10 ? 'TIE' : winnerMode(leg, aut, d),
      sampleCount: Math.max(leg.sampleCount, aut.sampleCount)
    };
  });

  const hybridRouting = buildHybridRouting(regimeComparisons);
  const uniqueRegimes = new Set(samples.map(s => s.regime)).size;
  const uniqueMarketTags = marketTags.size;
  const validationWarnings = buildValidationWarnings(
    eventsEvaluated,
    symbolsScanned,
    uniqueRegimes,
    uniqueMarketTags
  );
  const insufficientSample = eventsEvaluated < VALIDATION_MIN_EVENTS
    || symbolsScanned < VALIDATION_MIN_SYMBOLS
    || uniqueRegimes < VALIDATION_MIN_REGIMES;

  const { recommendation, productionReady, notes, weaknesses, readinessStatus } = recommendDefault(
    overallLegacy,
    overallAutonomous,
    delta,
    regimeComparisons,
    hybridRouting,
    eventsEvaluated,
    symbolsScanned,
    insufficientSample
  );

  return {
    advisoryOnly: true,
    generatedAt: Date.now(),
    lookbackDays,
    sessionsScanned,
    eventsEvaluated,
    symbolsScanned,
    overallLegacy,
    overallAutonomous,
    overallWinner,
    overallExpectancyDelta: Math.round(delta * 1000) / 1000,
    confidence: insufficientSample
      ? 'LOW'
      : confidenceLevel({
        eventCount: eventsEvaluated,
        symbolCount: symbolsScanned,
        regimeCount: uniqueRegimes,
        marketTagCount: uniqueMarketTags,
        expectancyDelta: delta
      }),
    regimeComparisons,
    marketComparisons,
    bestImprovements: findImprovements(regimeComparisons, marketComparisons),
    worstRegressions: findRegressions(regimeComparisons),
    failureModes: detectFailureModes(legacySamples, autoSamples),
    autonomousUnderperforms: regimeComparisons
      .filter(r => r.winner === 'LEGACY_RR')
      .map(r => `${r.regime}: legacy expectancy +${(-r.expectancyDelta).toFixed(2)}R (n=${r.sampleCount})`),
    legacyStillStronger: regimeComparisons
      .filter(r => r.winner === 'LEGACY_RR')
      .map(r => r.regime),
    defaultRecommendation: recommendation,
    hybridRouting,
    productionReady,
    productionReadyNotes: notes,
    remainingWeaknesses: weaknesses,
    readinessStatus,
    insufficientSample,
    validationWarnings,
    uniqueRegimes,
    uniqueMarketTags
  };
}

function buildValidationWarnings(
  events: number,
  symbols: number,
  regimes: number,
  markets: number
): string[] {
  const w: string[] = [];
  if (events < VALIDATION_MIN_EVENTS) {
    w.push(`Insufficient events: ${events} (minimum ${VALIDATION_MIN_EVENTS}) — report is indicative only`);
  }
  if (symbols < VALIDATION_MIN_SYMBOLS) {
    w.push(`Low symbol diversity: ${symbols} symbols (minimum ${VALIDATION_MIN_SYMBOLS})`);
  }
  if (regimes < VALIDATION_MIN_REGIMES) {
    w.push(`Low regime diversity: ${regimes} regimes (minimum ${VALIDATION_MIN_REGIMES})`);
  }
  if (markets < 3) {
    w.push(`Limited market-condition coverage: ${markets} tags`);
  }
  return w;
}

function winnerMode(
  leg: ReturnType<typeof aggregateModeMetrics>,
  aut: ReturnType<typeof aggregateModeMetrics>,
  delta: number
): ValidationPlanMode | 'TIE' {
  if (leg.sampleCount < 5 || aut.sampleCount < 5) return 'TIE';
  if (Math.abs(delta) < 0.04) return 'TIE';
  return delta > 0 ? 'AUTONOMOUS_TEMPLATE' : 'LEGACY_RR';
}

function buildHybridRouting(regimes: RegimeModeComparison[]): HybridRegimeRouting[] {
  return regimes
    .filter(r => r.sampleCount >= 8)
    .map(r => ({
      regime: r.regime,
      recommendedMode: r.winner === 'TIE' ? 'LEGACY_RR' as const : r.winner,
      reason: r.winner === 'AUTONOMOUS_TEMPLATE'
        ? `Autonomous expectancy ${r.autonomous.expectancy.toFixed(2)} vs legacy ${r.legacy.expectancy.toFixed(2)}`
        : r.winner === 'LEGACY_RR'
          ? `Legacy stronger by ${(-r.expectancyDelta).toFixed(2)}R expectancy`
          : 'Insufficient edge — default legacy'
    }));
}

function recommendDefault(
  leg: ReturnType<typeof aggregateModeMetrics>,
  aut: ReturnType<typeof aggregateModeMetrics>,
  delta: number,
  regimes: RegimeModeComparison[],
  hybrid: HybridRegimeRouting[],
  eventCount: number,
  symbolCount: number,
  insufficientSample: boolean
): {
  recommendation: DefaultModeRecommendation;
  productionReady: boolean;
  notes: string[];
  weaknesses: string[];
  readinessStatus: TemplateReadinessStatus;
} {
  const notes: string[] = ['LEGACY_RR remains production default (Phase 177 gate)'];
  const weaknesses: string[] = [];
  const autoWins = regimes.filter(r => r.winner === 'AUTONOMOUS_TEMPLATE').length;
  const legWins = regimes.filter(r => r.winner === 'LEGACY_RR').length;
  const chop = regimes.find(r => r.regime === 'EXHAUSTION_DRIFT');

  if (insufficientSample) {
    weaknesses.push('Validation under minimum sample / diversity thresholds');
  }
  if (aut.mfeCapturePct < leg.mfeCapturePct - 12) {
    weaknesses.push('Autonomous MFE capture materially below legacy — target calibration focus');
  }
  if (aut.targetEfficiency < leg.targetEfficiency - 10) {
    weaknesses.push('Autonomous target efficiency below legacy — continuation projection gap');
  }
  if (aut.lateExtensionFailureRate > leg.lateExtensionFailureRate + 8) {
    weaknesses.push('Autonomous late-extension failure rate elevated vs legacy');
  }

  let recommendation: DefaultModeRecommendation = 'LEGACY_RR';
  let readinessStatus: TemplateReadinessStatus = 'NOT_READY';

  if (!insufficientSample && delta >= 0.08 && eventCount >= VALIDATION_MIN_EVENTS && autoWins >= legWins + 2) {
    recommendation = 'AUTONOMOUS_TEMPLATE';
    readinessStatus = 'DEFAULT_READY';
    notes.push('Statistical gates met for global autonomous default (re-run validation to confirm)');
  } else if (!insufficientSample && autoWins >= 3 && legWins >= 2 && delta >= 0) {
    recommendation = 'HYBRID';
    readinessStatus = 'HYBRID_READY';
    notes.push('Regime-level split viable — autonomous for winning regimes only');
  } else {
    notes.push('Legacy remains default until autonomous expectancy +0.08R with n≥500');
  }

  if (chop?.winner === 'LEGACY_RR') {
    notes.push('EXHAUSTION_DRIFT / exhaustion contexts favor legacy');
  }

  const productionReady =
    readinessStatus === 'DEFAULT_READY'
      && delta >= 0.08
      && weaknesses.length === 0;

  return { recommendation, productionReady, notes, weaknesses, readinessStatus };
}

function findImprovements(
  regimes: RegimeModeComparison[],
  markets: ExecutionTemplateValidationReport['marketComparisons']
): string[] {
  const lines: string[] = [];
  for (const r of regimes.filter(x => x.expectancyDelta >= 0.08).slice(0, 4)) {
    lines.push(`${r.regime}: +${r.expectancyDelta.toFixed(2)}R expectancy (autonomous)`);
  }
  for (const m of markets.filter(x => x.autonomous.expectancy > x.legacy.expectancy + 0.06).slice(0, 3)) {
    lines.push(`${m.tag}: autonomous expectancy ${m.autonomous.expectancy.toFixed(2)} vs ${m.legacy.expectancy.toFixed(2)}`);
  }
  return lines.length ? lines : ['No regime exceeded +0.08R autonomous expectancy threshold'];
}

function findRegressions(regimes: RegimeModeComparison[]): string[] {
  return regimes
    .filter(r => r.expectancyDelta <= -0.06)
    .map(r => `${r.regime}: autonomous ${r.expectancyDelta.toFixed(2)}R vs legacy (n=${r.sampleCount})`);
}

function detectFailureModes(
  legacy: PlanOutcomeSample[],
  auto: PlanOutcomeSample[]
): ValidationFailureMode[] {
  const modes: ValidationFailureMode[] = [];

  const autoAggressive = auto.filter(s =>
    s.evaluation.stoppedOut && (s.evaluation.maeR ?? 0) <= -1.2 && s.regime === 'EARLY_EXPANSION'
  );
  if (autoAggressive.length >= 5) {
    modes.push({
      code: 'OVER_AGGRESSIVE_ENTRY',
      description: 'Early expansion autonomous entries with deep MAE before stop',
      mode: 'AUTONOMOUS_TEMPLATE',
      sampleCount: autoAggressive.length,
      severity: 'WARN'
    });
  }

  const looseStops = auto.filter(s => s.evaluation.stoppedOut && (s.evaluation.maeR ?? 0) <= -1.5);
  const legStops = legacy.filter(s => s.evaluation.stoppedOut && (s.evaluation.maeR ?? 0) <= -1.5);
  if (looseStops.length > legStops.length * 1.15 && looseStops.length >= 8) {
    modes.push({
      code: 'LOOSE_STOPS',
      description: 'Autonomous plans stopped with worse MAE than legacy cohort',
      mode: 'AUTONOMOUS_TEMPLATE',
      sampleCount: looseStops.length,
      severity: 'CRITICAL'
    });
  }

  const poorTargets = auto.filter(s => !s.evaluation.targetHit && (s.evaluation.mfeR ?? 0) < 0.5 && (s.plannedRr ?? 0) >= 2);
  if (poorTargets.length >= 10) {
    modes.push({
      code: 'POOR_TARGET_PROJECTION',
      description: 'High planned RR but weak MFE capture on autonomous targets',
      mode: 'AUTONOMOUS_TEMPLATE',
      sampleCount: poorTargets.length,
      severity: 'WARN'
    });
  }

  const exhaust = auto.filter(s => s.regime === 'EXHAUSTION_DRIFT' && s.evaluation.stoppedOut);
  if (exhaust.length >= 4) {
    modes.push({
      code: 'EXHAUSTION_EXIT_GAP',
      description: 'Exhaustion regime still taking stop hits — exit priority not fully protective',
      mode: 'AUTONOMOUS_TEMPLATE',
      sampleCount: exhaust.length,
      severity: 'WARN'
    });
  }

  return modes;
}
