import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence/signal-intelligence.store';
import { evaluatedSignals } from '../signal-intelligence/signal-intelligence.math';
import { LiveExecutionDecision, LiveExecutionDecisionSnapshot } from '../signal-intelligence/live-decision/live-decision.models';
import { TradingSignal } from '../../models/signal.model';
import { LiveRegimeSynthesisService } from '../live-regime-intelligence/live-regime-synthesis.service';
import { LiveRegimeInput } from '../live-regime-intelligence/live-regime.models';
import {
  ChartTriggerZone,
  ExecutionCard,
  ExecutionTriggerEntryType,
  ExecutionTriggerInput,
  ExecutionTriggerMetrics,
  ExecutionTriggerOverlay,
  ExecutionTriggerReport,
  RiskLevel,
  TraderExecutionAction,
  TriggerMomentRow
} from './execution-trigger.models';
import { MicroCompressionEngine } from './micro-compression.engine';
import { ShallowPullbackTriggerEngine } from './shallow-pullback-trigger.engine';
import { VwapPersistenceTriggerEngine } from './vwap-persistence-trigger.engine';
import { ContinuationAddEngine } from './continuation-add.engine';
import { OrbPersistenceEngine } from './orb-persistence.engine';
import { ExtensionHealthEngine } from './extension-health.engine';
import { MomentumStackEngine } from './momentum-stack.engine';
import { LateStageExhaustionEngine } from './late-stage-exhaustion.engine';
import {
  actionLabel,
  clamp,
  idealEntryZone,
  inputFromSignal,
  inputFromSnapshot,
  qualityLabel,
  riskFromScore,
  sessionDateFromTs,
  triggerMarker,
  vwapPersistenceMinutes,
  windowLabel
} from './execution-trigger.util';
import { IntelligenceOffloadService } from '../intelligence-offload/intelligence-offload.service';
import { ExecutionCardDto } from '../intelligence-offload/intelligence-snapshot-api.service';

/** Phase 163 — execution trigger intelligence orchestrator (advisory only). */
@Injectable({ providedIn: 'root' })
export class ExecutionTriggerSynthesisService {
  private readonly compression = new MicroCompressionEngine();
  private readonly shallowPb = new ShallowPullbackTriggerEngine();
  private readonly vwapPersist = new VwapPersistenceTriggerEngine();
  private readonly contAdd = new ContinuationAddEngine();
  private readonly orb = new OrbPersistenceEngine();
  private readonly extension = new ExtensionHealthEngine();
  private readonly momentum = new MomentumStackEngine();
  private readonly exhaustion = new LateStageExhaustionEngine();

  private readonly reportSubject = new BehaviorSubject<ExecutionTriggerReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(
    private store: SignalIntelligenceStore,
    private liveRegime: LiveRegimeSynthesisService,
    private offload: IntelligenceOffloadService
  ) {
    this.offload.bindRevisionRefresh(() => this.refresh(), this.store.revision$);
    if (!this.offload.skipFrontendSynthesis()) {
      this.refresh();
    }
  }

  snapshot(): ExecutionTriggerReport | null {
    return this.reportSubject.value;
  }

  refresh(
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
    filter: SignalIntelligenceFilter = {}
  ): ExecutionTriggerReport {
    if (this.offload.isEnabled() && filter.symbol) {
      this.offload.fetchExecutionCards(filter.symbol, lookbackDays).subscribe(dto => {
        this.reportSubject.next(this.mapBackendReport(dto, lookbackDays));
      });
    }

    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = evaluatedSignals(this.store.query({ ...filter, fromTs }));
    const activeTriggers: TriggerMomentRow[] = [];
    const cards: ExecutionCard[] = [];

    for (const s of signals) {
      const input = this.enrichInput(inputFromSnapshot(s, signals.length));
      const evaluated = this.evaluate(input, 'WAIT_FOR_PULLBACK');
      if (!evaluated.overlay.active || !evaluated.overlay.entryType) continue;
      if (evaluated.overlay.traderAction === 'DO_NOT_CHASE' || evaluated.overlay.traderAction === 'LATE_STAGE_EXHAUSTION') {
        activeTriggers.push(this.toMomentRow(s, evaluated.overlay, evaluated.whyValid));
        continue;
      }
      activeTriggers.push(this.toMomentRow(s, evaluated.overlay, evaluated.whyValid));
      cards.push(this.toCard(input, evaluated.overlay));
    }

    activeTriggers.sort((a, b) => b.triggerScore - a.triggerScore);
    cards.sort((a, b) => b.expansionProbability - a.expansionProbability);

    const report: ExecutionTriggerReport = {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: Date.now(),
      sampleCount: signals.length,
      activeTriggers: activeTriggers.slice(0, 25),
      shallowPullbackEntries: activeTriggers.filter(t => t.entryType === 'SHALLOW_PULLBACK_ENTRY').slice(0, 12),
      compressionBreakouts: activeTriggers.filter(t => t.entryType === 'MICRO_COMPRESSION_BREAKOUT').slice(0, 12),
      vwapPersistenceEntries: activeTriggers.filter(t => t.entryType === 'VWAP_PERSISTENCE_ENTRY').slice(0, 12),
      addOpportunities: activeTriggers.filter(t => t.addOpportunity).slice(0, 12),
      exhaustionMoments: activeTriggers.filter(t =>
        t.traderAction === 'LATE_STAGE_EXHAUSTION' || t.traderAction === 'DO_NOT_CHASE'
      ).slice(0, 12),
      executionCards: cards.slice(0, 20),
      summaryInsights: this.buildInsights(signals.length, activeTriggers.length, cards.length)
    };

    this.reportSubject.next(report);
    return report;
  }

  applyToLiveDecision(
    snapshot: LiveExecutionDecisionSnapshot,
    input: ExecutionTriggerInput
  ): LiveExecutionDecisionSnapshot {
    const enriched = this.enrichInput(input);
    const { overlay } = this.evaluate(enriched);

    if (!overlay.active) {
      return { ...snapshot, executionTrigger: overlay };
    }

    const shouldPromote = overlay.promotedDecision !== overlay.originalDecision
      && overlay.traderAction !== 'DO_NOT_CHASE'
      && overlay.traderAction !== 'LATE_STAGE_EXHAUSTION';

    if (!shouldPromote) {
      return { ...snapshot, executionTrigger: overlay };
    }

    return {
      ...snapshot,
      decision: overlay.promotedDecision,
      decisionLabel: actionLabel(overlay.traderAction),
      keyReason: overlay.triggerReason,
      compactLine: `${triggerMarker(overlay.entryType!)} · ${overlay.triggerScore}`,
      detailLine: overlay.addOpportunity ? 'Add opportunity — compression breakout valid' : overlay.triggerReason,
      executionTrigger: overlay
    };
  }

  evaluateForReplay(signal: TradingSignal, original: LiveExecutionDecision): ExecutionTriggerOverlay | null {
    const n = this.store.query({ symbol: (signal.symbol ?? 'UNK').toUpperCase() }).length;
    const overlay = this.buildOverlay(original, this.enrichInput(inputFromSignal(signal, n)));
    return overlay.active ? overlay : null;
  }

  buildCard(input: ExecutionTriggerInput, original: LiveExecutionDecision): ExecutionCard | null {
    const overlay = this.buildOverlay(original, this.enrichInput(input));
    if (!overlay.active) return null;
    return this.toCard(input, overlay);
  }

  buildOverlay(original: LiveExecutionDecision, input: ExecutionTriggerInput): ExecutionTriggerOverlay {
    if (this.offload.isEnabled()) {
      const cached = this.reportSubject.value?.executionCards.find(c => c.symbol === input.symbol.toUpperCase());
      if (cached) return this.overlayFromCard(original, cached);
    }
    return this.evaluate(input, original).overlay;
  }

  evaluate(input: ExecutionTriggerInput, original: LiveExecutionDecision = 'WAIT_FOR_PULLBACK'): {
    overlay: ExecutionTriggerOverlay;
    whyValid: string;
  } {
    const metrics = this.computeMetrics(input);
    const exhaustionDrift = metrics.exhaustionDrift;
    const expansionProbability = input.regimeMetrics?.expansionProbability
      ?? clamp(metrics.continuationIntegrity * 0.6 + metrics.extensionHealth * 0.4);

    if (this.exhaustion.isDoNotChase(input)) {
      return {
        overlay: this.exhaustionOverlay(original, metrics, input, expansionProbability),
        whyValid: 'Extension without RVOL sustain — chase risk elevated'
      };
    }

    if (this.exhaustion.isExhaustion(input)) {
      return {
        overlay: this.exhaustionOverlay(original, metrics, input, expansionProbability, 'LATE_STAGE_EXHAUSTION'),
        whyValid: 'Acceleration degrading — exhaustion drift detected'
      };
    }

    const candidates = this.rankTriggers(input, metrics);
    const best = candidates[0];
    if (!best || best.score < 55) {
      return {
        overlay: this.inactiveOverlay(original, metrics, expansionProbability),
        whyValid: 'No tactical trigger — continuation integrity insufficient'
      };
    }

    const traderAction = this.traderAction(best.entryType, best.add);
    const chartZone = this.chartZone(best.entryType, metrics);
    const triggerScore = best.score;
    const continuationRisk = riskFromScore(metrics.continuationIntegrity);
    const promoted = this.promotedDecision(original, triggerScore, traderAction);
    const zone = idealEntryZone(input.price, input.vwapDistance);

    return {
      overlay: {
        active: true,
        entryType: best.entryType,
        traderAction,
        metrics,
        triggerScore,
        triggerReason: this.triggerReason(best.entryType, metrics, input),
        idealEntryZone: zone,
        continuationRisk,
        chartZone,
        vwapPersistenceMinutes: vwapPersistenceMinutes(input),
        expansionProbability,
        originalDecision: original,
        promotedDecision: promoted,
        addOpportunity: best.add,
        advisoryOnly: true
      },
      whyValid: this.whyValid(best.entryType, metrics, input)
    };
  }

  private computeMetrics(input: ExecutionTriggerInput): ExecutionTriggerMetrics {
    const regime = input.regimeMetrics;
    return {
      continuationIntegrity: regime?.continuationPersistenceScore
        ?? clamp((input.trendAlignment ?? 0) * 0.6 + (input.rvol ?? 0) * 8),
      pullbackEfficiency: this.shallowPb.pullbackEfficiency(input),
      compressionEnergy: this.compression.compressionEnergy(input),
      extensionHealth: this.extension.extensionHealth(input),
      continuationVelocity: this.momentum.continuationVelocity(input),
      institutionalPressure: this.momentum.institutionalPressure(input),
      exhaustionDrift: this.exhaustion.exhaustionDrift(input)
    };
  }

  private rankTriggers(
    input: ExecutionTriggerInput,
    metrics: ExecutionTriggerMetrics
  ): { entryType: ExecutionTriggerEntryType; score: number; add: boolean }[] {
    const scores: { entryType: ExecutionTriggerEntryType; score: number; add: boolean }[] = [
      { entryType: 'DIRECT_CONTINUATION_ENTRY', score: this.directScore(input, metrics), add: false },
      { entryType: 'SHALLOW_PULLBACK_ENTRY', score: this.shallowPb.score(input), add: false },
      { entryType: 'VWAP_PERSISTENCE_ENTRY', score: this.vwapPersist.score(input), add: false },
      { entryType: 'MICRO_COMPRESSION_BREAKOUT', score: this.compression.compressionEnergy(input), add: true },
      { entryType: 'ORB_CONTINUATION_ADD', score: this.orb.score(input), add: true },
      { entryType: 'ACCELERATION_RECLAIM', score: this.reclaimScore(input, metrics), add: false },
      { entryType: 'TREND_RESUMPTION_ENTRY', score: this.resumptionScore(input, metrics), add: false }
    ];
    return scores.sort((a, b) => b.score - a.score);
  }

  private directScore(input: ExecutionTriggerInput, m: ExecutionTriggerMetrics): number {
    let s = m.continuationIntegrity * 0.35 + m.continuationVelocity * 0.35 + m.extensionHealth * 0.2;
    if ((input.rvol ?? 0) >= 2.5) s += 10;
    if ((input.vwapDistance ?? 0) >= 0) s += 8;
    return clamp(s);
  }

  private reclaimScore(input: ExecutionTriggerInput, m: ExecutionTriggerMetrics): number {
    const depth = input.pullbackDepth ?? Math.abs(input.vwapDistance ?? 0);
    if (depth > 0.025) return 0;
    return clamp(m.continuationVelocity * 0.5 + m.pullbackEfficiency * 0.35 + (input.rvol ?? 0) * 5);
  }

  private resumptionScore(input: ExecutionTriggerInput, m: ExecutionTriggerMetrics): number {
    const mins = input.sessionTimeMinutes ?? 0;
    if (mins < 45) return 0;
    return clamp(m.compressionEnergy * 0.4 + m.continuationIntegrity * 0.35 + m.extensionHealth * 0.25);
  }

  private traderAction(entryType: ExecutionTriggerEntryType, add: boolean): TraderExecutionAction {
    if (add && entryType === 'MICRO_COMPRESSION_BREAKOUT') return 'ADD_ON_COMPRESSION_BREAKOUT';
    if (add && entryType === 'ORB_CONTINUATION_ADD') return 'ADD_ON_COMPRESSION_BREAKOUT';
    switch (entryType) {
      case 'DIRECT_CONTINUATION_ENTRY': return 'EARLY_CONTINUATION_ENTRY';
      case 'SHALLOW_PULLBACK_ENTRY': return 'HEALTHY_SHALLOW_PULLBACK';
      case 'VWAP_PERSISTENCE_ENTRY': return 'VWAP_HOLD_CONTINUATION';
      case 'MICRO_COMPRESSION_BREAKOUT': return 'ADD_ON_COMPRESSION_BREAKOUT';
      case 'ORB_CONTINUATION_ADD': return 'ADD_ON_COMPRESSION_BREAKOUT';
      case 'ACCELERATION_RECLAIM': return 'EARLY_CONTINUATION_ENTRY';
      case 'TREND_RESUMPTION_ENTRY': return 'TREND_RESUMPTION_READY';
    }
  }

  private chartZone(entryType: ExecutionTriggerEntryType, m: ExecutionTriggerMetrics): ChartTriggerZone {
    if (m.exhaustionDrift >= 65) return 'EXHAUSTION_DEVELOPING';
    if (m.extensionHealth < 45 && m.continuationIntegrity >= 55) return 'EXTENSION_WARNING';
    switch (entryType) {
      case 'SHALLOW_PULLBACK_ENTRY': return 'SHALLOW_PULLBACK_HOLD';
      case 'MICRO_COMPRESSION_BREAKOUT': return 'COMPRESSION_BREAKOUT';
      case 'VWAP_PERSISTENCE_ENTRY': return 'VWAP_PERSISTENCE';
      default: return 'CONTINUATION_ENTRY';
    }
  }

  private promotedDecision(
    original: LiveExecutionDecision,
    score: number,
    action: TraderExecutionAction
  ): LiveExecutionDecision {
    if (action === 'DO_NOT_CHASE' || action === 'LATE_STAGE_EXHAUSTION') return original;
    const isWait = original.includes('WAIT') || original === 'AVOID_CHASE' || original === 'REDUCE_SIZE';
    if (!isWait) return original;
    if (score >= 72) return 'FULL_EXECUTION';
    if (score >= 58) return 'PROBING_EXECUTION';
    return original;
  }

  private triggerReason(
    entryType: ExecutionTriggerEntryType,
    m: ExecutionTriggerMetrics,
    input: ExecutionTriggerInput
  ): string {
    const rvol = (input.rvol ?? 0).toFixed(1);
    return `${entryType.replace(/_/g, ' ')} · integrity ${m.continuationIntegrity} · RVOL ${rvol}x · ${windowLabel(input.sessionTimeMinutes)}`;
  }

  private whyValid(
    entryType: ExecutionTriggerEntryType,
    m: ExecutionTriggerMetrics,
    input: ExecutionTriggerInput
  ): string {
    if (entryType === 'SHALLOW_PULLBACK_ENTRY') {
      return `Shallow PB held above VWAP — pullback efficiency ${m.pullbackEfficiency}% without deep retrace`;
    }
    if (entryType === 'VWAP_PERSISTENCE_ENTRY') {
      return `VWAP maintained ${vwapPersistenceMinutes(input)}m — institutional pressure ${m.institutionalPressure}%`;
    }
    if (entryType === 'MICRO_COMPRESSION_BREAKOUT') {
      return `Tight compression energy ${m.compressionEnergy}% — continuation resumed without ideal pullback`;
    }
    return `Continuation intact · velocity ${m.continuationVelocity}% · extension health ${m.extensionHealth}%`;
  }

  private enrichInput(input: ExecutionTriggerInput): ExecutionTriggerInput {
    const regimeInput: LiveRegimeInput = {
      symbol: input.symbol,
      signalType: input.signalType,
      marketRegime: input.marketRegime,
      sessionTimeMinutes: input.sessionTimeMinutes,
      rvol: input.rvol,
      vwapDistance: input.vwapDistance,
      trendAlignment: input.trendAlignment,
      extended: input.extended,
      structureScore: input.structureScore,
      volatility: input.volatility,
      pullbackDepth: input.pullbackDepth,
      sampleCount: input.sampleCount
    };
    const regime = this.liveRegime.evaluate(regimeInput);
    return { ...input, regimeMetrics: regime.metrics };
  }

  private toMomentRow(
    s: import('../../models/signal-intelligence.model').SignalSnapshot,
    overlay: ExecutionTriggerOverlay,
    whyValid: string
  ): TriggerMomentRow {
    return {
      symbol: s.symbol,
      sessionDate: sessionDateFromTs(s.timestamp),
      timestamp: s.timestamp,
      entryType: overlay.entryType ?? 'DIRECT_CONTINUATION_ENTRY',
      traderAction: overlay.traderAction,
      triggerScore: overlay.triggerScore,
      triggerReason: overlay.triggerReason,
      whyValid,
      addOpportunity: overlay.addOpportunity
    };
  }

  private toCard(input: ExecutionTriggerInput, overlay: ExecutionTriggerOverlay): ExecutionCard {
    return {
      symbol: input.symbol,
      action: overlay.traderAction,
      entryType: overlay.entryType,
      continuationIntegrity: riskFromScore(overlay.metrics.continuationIntegrity),
      rvolLabel: `${(input.rvol ?? 0).toFixed(1)}x sustained`,
      shallowPbQuality: qualityLabel(overlay.metrics.pullbackEfficiency),
      vwapPersistenceLabel: `${overlay.vwapPersistenceMinutes}m`,
      expansionProbability: overlay.expansionProbability,
      idealEntryZone: overlay.idealEntryZone,
      continuationRisk: overlay.continuationRisk,
      triggerReason: overlay.triggerReason,
      windowLabel: windowLabel(input.sessionTimeMinutes)
    };
  }

  private inactiveOverlay(
    original: LiveExecutionDecision,
    metrics: ExecutionTriggerMetrics,
    expansionProbability: number
  ): ExecutionTriggerOverlay {
    return {
      active: false,
      entryType: null,
      traderAction: 'DO_NOT_CHASE',
      metrics,
      triggerScore: 0,
      triggerReason: '',
      idealEntryZone: null,
      continuationRisk: 'HIGH',
      chartZone: 'EXHAUSTION_DEVELOPING',
      vwapPersistenceMinutes: 0,
      expansionProbability,
      originalDecision: original,
      promotedDecision: original,
      addOpportunity: false,
      advisoryOnly: true
    };
  }

  private exhaustionOverlay(
    original: LiveExecutionDecision,
    metrics: ExecutionTriggerMetrics,
    input: ExecutionTriggerInput,
    expansionProbability: number,
    action: TraderExecutionAction = 'DO_NOT_CHASE'
  ): ExecutionTriggerOverlay {
    return {
      active: true,
      entryType: null,
      traderAction: action,
      metrics,
      triggerScore: metrics.exhaustionDrift,
      triggerReason: action === 'LATE_STAGE_EXHAUSTION'
        ? 'Late-stage exhaustion — acceleration degrading'
        : 'Do not chase — extension without sustain',
      idealEntryZone: null,
      continuationRisk: 'HIGH',
      chartZone: 'EXHAUSTION_DEVELOPING',
      vwapPersistenceMinutes: vwapPersistenceMinutes(input),
      expansionProbability,
      originalDecision: original,
      promotedDecision: original,
      addOpportunity: false,
      advisoryOnly: true
    };
  }

  private buildInsights(n: number, triggers: number, cards: number): string[] {
    return [
      n < 10 ? 'Insufficient sample — hydrate history before trusting trigger intelligence.' : `${triggers} tactical triggers in ${n} evaluated signals.`,
      `${cards} actionable execution cards generated with ideal entry zones.`,
      'Big winners skip deep pullbacks — triggers fire on shallow digestion + RVOL sustain.',
      'Advisory only — no auto-trading, threshold mutation, or autonomous sizing.'
    ];
  }

  private mapBackendReport(
    dto: import('../intelligence-offload/intelligence-snapshot-api.service').ExecutionCardsSnapshotDto,
    lookbackDays: number
  ): ExecutionTriggerReport {
    const cards = dto.cards.map(c => this.cardFromDto(c));
    return {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: dto.generatedAt,
      sampleCount: cards.length,
      activeTriggers: [],
      shallowPullbackEntries: [],
      compressionBreakouts: [],
      vwapPersistenceEntries: [],
      addOpportunities: [],
      exhaustionMoments: [],
      executionCards: cards,
      summaryInsights: dto.summaryInsights
    };
  }

  private cardFromDto(c: ExecutionCardDto): ExecutionCard {
    return {
      symbol: c.symbol,
      action: c.action as TraderExecutionAction,
      entryType: c.entryType as ExecutionTriggerEntryType,
      continuationIntegrity: c.continuationIntegrity as RiskLevel,
      rvolLabel: c.rvolLabel,
      shallowPbQuality: c.shallowPbQuality,
      vwapPersistenceLabel: c.vwapPersistenceLabel,
      expansionProbability: c.expansionProbability,
      idealEntryZone: c.idealEntryZone,
      continuationRisk: c.continuationRisk as RiskLevel,
      triggerReason: c.triggerReason,
      windowLabel: c.windowLabel
    };
  }

  private overlayFromCard(original: LiveExecutionDecision, card: ExecutionCard): ExecutionTriggerOverlay {
    const isExhaustion = card.action === 'DO_NOT_CHASE' || card.action === 'LATE_STAGE_EXHAUSTION';
    return {
      active: !isExhaustion,
      entryType: card.entryType,
      traderAction: card.action,
      metrics: {
        continuationIntegrity: card.continuationIntegrity === 'LOW' ? 75 : 60,
        pullbackEfficiency: 65,
        compressionEnergy: 55,
        extensionHealth: 60,
        continuationVelocity: 62,
        institutionalPressure: 58,
        exhaustionDrift: isExhaustion ? 75 : 25
      },
      triggerScore: card.expansionProbability,
      triggerReason: card.triggerReason,
      idealEntryZone: card.idealEntryZone,
      continuationRisk: card.continuationRisk,
      chartZone: isExhaustion ? 'EXHAUSTION_DEVELOPING' : 'CONTINUATION_ENTRY',
      vwapPersistenceMinutes: parseInt(card.vwapPersistenceLabel, 10) || 0,
      expansionProbability: card.expansionProbability,
      originalDecision: original,
      promotedDecision: isExhaustion ? original : (card.expansionProbability >= 72 ? 'FULL_EXECUTION' : 'PROBING_EXECUTION'),
      addOpportunity: card.action === 'ADD_ON_COMPRESSION_BREAKOUT',
      advisoryOnly: true
    };
  }

  private emptyReport(lookbackDays: number): ExecutionTriggerReport {
    return {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: Date.now(),
      sampleCount: 0,
      activeTriggers: [],
      shallowPullbackEntries: [],
      compressionBreakouts: [],
      vwapPersistenceEntries: [],
      addOpportunities: [],
      exhaustionMoments: [],
      executionCards: [],
      summaryInsights: ['Backend snapshot mode — select symbol to load trigger intelligence']
    };
  }
}
