import { Injectable } from '@angular/core';
import { TradingSignal } from '../../models/signal.model';
import { EntryDecisionOverlay, EntryDecisionType } from './replay-decision-visualization.models';
import { ContinuationPromotionSynthesisService } from '../signal-intelligence/continuation-promotion/continuation-promotion-synthesis.service';
import { ExpansionParticipationSynthesisService } from '../signal-intelligence/opening-expansion/expansion-participation-synthesis.service';
import { ContinuationParticipationSynthesisService } from '../signal-intelligence/continuation-participation/continuation-participation-synthesis.service';
import { AutonomousExecutionSynthesisService } from '../signal-intelligence/autonomous-execution/autonomous-execution-synthesis.service';
import { ExecutionModeService } from '../signal-intelligence/execution-mode.service';
import { LiveExecutionDecision } from '../signal-intelligence/live-decision/live-decision.models';
import {
  entryTypeLabel,
  promotionMarkerColor
} from '../signal-intelligence/continuation-promotion/continuation-promotion.util';
import {
  entryTypeMarker,
  expansionMarkerColor
} from '../signal-intelligence/opening-expansion/opening-expansion.util';
import {
  participationMarker,
  participationMarkerColor
} from '../signal-intelligence/continuation-participation/continuation-participation.util';
import {
  autonomousMarker,
  autonomousMarkerColor
} from '../signal-intelligence/autonomous-execution/autonomous-execution.util';
import { LiveRegimeSynthesisService } from '../live-regime-intelligence/live-regime-synthesis.service';
import { RegimeExplanationService } from '../explainable-regimes/regime-explanation.service';
import { ClusterFamilyExplanationEngine } from '../cluster-family-intelligence/cluster-family-explanation.engine';
import { regimeMarker, regimeMarkerColor } from '../live-regime-intelligence/live-regime.util';
import { ExecutionTriggerSynthesisService } from '../execution-trigger-intelligence/execution-trigger-synthesis.service';
import { triggerMarker, triggerMarkerColor } from '../execution-trigger-intelligence/execution-trigger.util';

const TRAP_TYPES = new Set(['OPEN_FAIL', 'OPEN_FAIL_BREAK', 'OPEN_FAIL_READY', 'RECOVERY_FAIL', 'RECOVERY_FAIL_READY', 'IMBALANCE_DOWN']);
const ENTRY_TYPES = new Set(['MOM_BUY', 'PULL_BUY', 'CONT_BUY', 'OPEN_MOM_BUY']);

@Injectable({ providedIn: 'root' })
export class ReplayEntryDecisionEngine {
  private readonly familyExplain = new ClusterFamilyExplanationEngine();

  constructor(
    private continuationPromotion: ContinuationPromotionSynthesisService,
    private openingExpansion: ExpansionParticipationSynthesisService,
    private continuationParticipation: ContinuationParticipationSynthesisService,
    private autonomousExecution: AutonomousExecutionSynthesisService,
    private liveRegime: LiveRegimeSynthesisService,
    private regimeExplainer: RegimeExplanationService,
    private executionTrigger: ExecutionTriggerSynthesisService,
    private executionMode: ExecutionModeService
  ) {}

  classify(signal: TradingSignal): EntryDecisionType {
    return this.buildOverlay(signal).type;
  }

  /** Legacy score-based baseline (pre-promotion). */
  classifyLegacy(signal: TradingSignal): EntryDecisionType {
    if (TRAP_TYPES.has(signal.signalType)) return 'TRAP_RISK';
    if (signal.extended) return 'REDUCE_SIZE';
    const score = signal.confidenceScore ?? 0;
    if (!ENTRY_TYPES.has(signal.signalType) && !signal.signalType.endsWith('_BUY')) {
      if (signal.signalType.endsWith('_READY')) return 'WAIT_FOR_PULLBACK';
      return 'AVOID_TRADE';
    }
    if (score >= 78) return 'FULL_EXECUTION';
    if (score >= 62) return 'PROBING_EXECUTION';
    if (score >= 45) return 'WAIT_FOR_PULLBACK';
    return score >= 30 ? 'PROBING_EXECUTION' : 'AVOID_TRADE';
  }

  buildOverlay(signal: TradingSignal): EntryDecisionOverlay {
    const legacy = this.classifyLegacy(signal);
    const opening = this.buildDirectOpeningExpansionOverlay(signal, legacy);
    if (opening) return this.enrichWithTriggerHint(opening, signal, legacy);

    const trigger = this.buildExecutionTriggerOverlay(signal, legacy);
    if (trigger) return trigger;

    const autonomous = this.buildAutonomousExecutionOverlay(signal, legacy);
    if (autonomous) return this.enrichWithTriggerHint(autonomous, signal, legacy);

    const participation = this.buildContinuationParticipationOverlay(signal, legacy);
    if (participation) return this.enrichWithTriggerHint(participation, signal, legacy);

    const regime = this.buildLiveRegimeOverlay(signal, legacy);
    if (regime) return regime;

    if (!this.executionMode.isLegacyEnabled()) {
      return this.buildWaitOverlay(signal, legacy);
    }

    const direct = this.buildDirectContinuationOverlay(signal, legacy);
    if (direct) return direct;

    const baseDecision = this.legacyToLive(legacy);
    const promotion = this.continuationPromotion.promoteSignal(signal, baseDecision);
    const showPromotedMarker = promotion.active && promotion.continuationEntryType != null
      && (promotion.promotedDecision !== promotion.originalDecision
        || this.isContinuationSetup(signal.signalType));
    const type = showPromotedMarker && promotion.continuationEntryType
      ? promotion.continuationEntryType as EntryDecisionType
      : this.liveToEntry(promotion.promotedDecision, legacy);
    const convictionPct = Math.round(signal.confidenceScore ?? this.inferScore(signal, type));
    const promoted = showPromotedMarker;
    const rationale = promoted
      ? `${promotion.promotionReason} (was ${promotion.originalDecision.replace(/_/g, ' ')})`
      : this.rationale(signal, type);
    const compact = promoted && promotion.continuationEntryType
      ? this.promotionLabel(promotion.continuationEntryType, convictionPct, promotion.expectedR)
      : this.compactLabel(type, convictionPct, signal);

    return {
      type,
      compactLabel: compact,
      fullLabel: promoted ? entryTypeLabel(promotion.continuationEntryType!) : this.fullLabel(type),
      convictionPct: promoted ? Math.min(95, convictionPct + 12) : convictionPct,
      rationale,
      markerText: compact,
      markerColor: promoted ? promotionMarkerColor(true) : this.color(type),
      shape: type === 'TRAP_RISK' || type === 'AVOID_TRADE' ? 'circle' : 'arrowUp',
      position: type === 'TRAP_RISK' || type === 'AVOID_TRADE' ? 'aboveBar' : 'belowBar',
      promoted,
      originalDecision: promotion.originalDecision,
      continuationEntryType: promotion.continuationEntryType ?? undefined,
      promotionReason: promotion.promotionReason,
      expectedR: promotion.expectedR != null ? `+${promotion.expectedR}R` : null
    };
  }

  /**
   * Phase 160 — autonomous execution markers (cyan/purple).
   */
  private buildAutonomousExecutionOverlay(
    signal: TradingSignal,
    legacy: EntryDecisionType
  ): EntryDecisionOverlay | null {
    if (!this.executionMode.isAutonomousPrimary()) return null;
    if (TRAP_TYPES.has(signal.signalType) || legacy === 'TRAP_RISK') return null;

    const base = this.legacyToLive(legacy);
    const overlay = this.autonomousExecution.evaluateForReplay(signal, base);
    if (!overlay?.active || !overlay.entryType) return null;

    const entryType = overlay.entryType as EntryDecisionType;
    const convictionPct = Math.min(95, overlay.autonomousEntryScore);
    const family = overlay.clusterFamily;
    const display = family?.displayLabel ?? overlay.entryType.replace(/_/g, ' ');
    const compact = `${display}\n${convictionPct}%`;
    const rationale = family
      ? [family.traderPromotionReason, ...this.familyExplain.expandableBlock(family)].join(' · ')
      : overlay.promotionReason;

    return {
      type: entryType,
      compactLabel: compact,
      fullLabel: display,
      convictionPct,
      rationale,
      markerText: compact,
      markerColor: autonomousMarkerColor(),
      shape: 'arrowUp',
      position: 'belowBar',
      promoted: true,
      originalDecision: overlay.originalDecision,
      autonomousExecution: true,
      autonomousEntryType: overlay.entryType,
      promotionReason: overlay.promotionReason,
      expectedR: overlay.expectedR != null ? `+${overlay.expectedR}R` : null
    };
  }

  /** Phase 159 — continuation participation markers. */
  private buildContinuationParticipationOverlay(
    signal: TradingSignal,
    legacy: EntryDecisionType
  ): EntryDecisionOverlay | null {
    if (!this.executionMode.isAutonomousPrimary()) return null;
    if (TRAP_TYPES.has(signal.signalType) || legacy === 'TRAP_RISK') return null;

    const base = this.legacyToLive(legacy);
    const overlay = this.continuationParticipation.evaluateForReplay(signal, base);
    if (!overlay?.active || !overlay.signalType) return null;

    const entryType = overlay.signalType as EntryDecisionType;
    const convictionPct = Math.min(95, overlay.participationScore);
    const label = participationMarker(overlay.signalType);
    const compact = `${label}\n${convictionPct}%`;

    return {
      type: entryType,
      compactLabel: compact,
      fullLabel: overlay.signalType.replace(/_/g, ' '),
      convictionPct,
      rationale: overlay.promotionReason,
      markerText: compact,
      markerColor: participationMarkerColor(),
      shape: 'arrowUp',
      position: 'belowBar',
      promoted: true,
      originalDecision: overlay.originalDecision,
      continuationParticipation: true,
      participationSignalType: overlay.signalType,
      promotionReason: overlay.promotionReason,
      expectedR: overlay.expectedR != null ? `+${overlay.expectedR}R` : null
    };
  }

  /** Phase 162 — subtle live regime markers when no higher overlay fires. */
  private buildLiveRegimeOverlay(
    signal: TradingSignal,
    legacy: EntryDecisionType
  ): EntryDecisionOverlay | null {
    if (TRAP_TYPES.has(signal.signalType) || legacy === 'TRAP_RISK') return null;

    const base = this.legacyToLive(legacy);
    const overlay = this.liveRegime.evaluateForReplay(signal, base);
    if (!overlay?.active || !overlay.classification) return null;

    const label = regimeMarker(overlay.classification);
    const score = overlay.metrics.continuationPersistenceScore;
    const compact = `${label}\n${score}%`;
    const isExhaustion = overlay.classification === 'LATE_STAGE_EXHAUSTION';
    const explained = this.regimeExplainer.explainSignal(signal);
    const timeline = explained.triggerSequence.map(e => `${e.time} ${e.event}`).join(' · ');
    const numericRationale = [
      ...explained.whyEntryValid.slice(0, 3),
      `conviction ${explained.finalConviction} (base ${explained.convictionBase})`,
      timeline
    ].filter(Boolean).join(' | ');

    return {
      type: legacy,
      compactLabel: compact,
      fullLabel: overlay.classification.replace(/_/g, ' '),
      convictionPct: explained.finalConviction,
      rationale: numericRationale || overlay.promotionReason,
      markerText: compact,
      markerColor: regimeMarkerColor(overlay.classification),
      shape: isExhaustion ? 'circle' : 'arrowUp',
      position: isExhaustion ? 'aboveBar' : 'belowBar',
      promoted: overlay.participationOpportunity,
      originalDecision: overlay.originalDecision,
      liveRegime: true,
      liveRegimeClassification: overlay.classification,
      promotionReason: overlay.promotionReason,
      expectedR: overlay.metrics.expansionProbability >= 60 ? `+${(overlay.metrics.expansionProbability / 30).toFixed(1)}R` : null
    };
  }

  /** Phase 163 — precise execution trigger markers. */
  private buildExecutionTriggerOverlay(
    signal: TradingSignal,
    legacy: EntryDecisionType
  ): EntryDecisionOverlay | null {
    if (TRAP_TYPES.has(signal.signalType) || legacy === 'TRAP_RISK') return null;

    const base = this.legacyToLive(legacy);
    const overlay = this.executionTrigger.evaluateForReplay(signal, base);
    if (!overlay?.active) return null;

    const isExhaustion = overlay.traderAction === 'DO_NOT_CHASE'
      || overlay.traderAction === 'LATE_STAGE_EXHAUSTION';

    if (isExhaustion) {
      const compact = `EXHAUST\n${overlay.metrics.exhaustionDrift}%`;
      return {
        type: legacy,
        compactLabel: compact,
        fullLabel: overlay.traderAction.replace(/_/g, ' '),
        convictionPct: overlay.metrics.exhaustionDrift,
        rationale: overlay.triggerReason,
        markerText: compact,
        markerColor: triggerMarkerColor('EXHAUSTION_DEVELOPING'),
        shape: 'circle',
        position: 'aboveBar',
        promoted: false,
        executionTrigger: true,
        triggerAction: overlay.traderAction,
        promotionReason: overlay.triggerReason
      };
    }

    if (!overlay.entryType) return null;
    const label = triggerMarker(overlay.entryType);
    const compact = `${label}\n${overlay.triggerScore}%`;
    return {
      type: legacy,
      compactLabel: compact,
      fullLabel: overlay.traderAction.replace(/_/g, ' '),
      convictionPct: overlay.triggerScore,
      rationale: `${overlay.triggerReason} · why: continuation intact without deep PB`,
      markerText: compact,
      markerColor: triggerMarkerColor(overlay.chartZone),
      shape: 'arrowUp',
      position: 'belowBar',
      promoted: overlay.promotedDecision !== overlay.originalDecision,
      originalDecision: overlay.originalDecision,
      executionTrigger: true,
      triggerEntryType: overlay.entryType,
      triggerAction: overlay.traderAction,
      promotionReason: overlay.triggerReason,
      expectedR: overlay.expansionProbability >= 60 ? `+${(overlay.expansionProbability / 28).toFixed(1)}R` : null
    };
  }

  private enrichWithTriggerHint(
    overlay: EntryDecisionOverlay,
    signal: TradingSignal,
    legacy: EntryDecisionType
  ): EntryDecisionOverlay {
    const base = this.legacyToLive(legacy);
    const trigger = this.executionTrigger.evaluateForReplay(signal, base);
    if (!trigger?.active || !trigger.entryType) {
      return this.enrichWithRegimeHint(overlay, signal, legacy);
    }
    const hint = triggerMarker(trigger.entryType);
    return {
      ...overlay,
      markerText: `${overlay.markerText}\n${hint}`,
      markerColor: triggerMarkerColor(trigger.chartZone),
      executionTrigger: true,
      triggerEntryType: trigger.entryType,
      triggerAction: trigger.traderAction,
      promotionReason: trigger.triggerReason
    };
  }

  /** Append regime hint to primary overlay marker text. */
  private enrichWithRegimeHint(
    overlay: EntryDecisionOverlay,
    signal: TradingSignal,
    legacy: EntryDecisionType
  ): EntryDecisionOverlay {
    const base = this.legacyToLive(legacy);
    const regime = this.liveRegime.evaluateForReplay(signal, base);
    if (!regime?.active || !regime.chartHint) return overlay;
    if (regime.classification === 'LATE_STAGE_EXHAUSTION' || regime.classification === 'CHOP_UNSTABLE') {
      return {
        ...overlay,
        markerText: `${overlay.markerText}\n${regime.chartHint}`,
        rationale: `${overlay.rationale} · ${regime.promotionReason}`
      };
    }
    if (regime.metrics.continuationPersistenceScore >= 58) {
      return {
        ...overlay,
        markerText: `${overlay.markerText}\n${regime.chartHint}`,
        liveRegime: true,
        liveRegimeClassification: regime.classification ?? undefined
      };
    }
    return overlay;
  }

  /** Fallback WAIT marker when autonomous mode skips legacy overlays. */
  private buildWaitOverlay(signal: TradingSignal, legacy: EntryDecisionType): EntryDecisionOverlay {
    const type = legacy;
    const convictionPct = Math.round(signal.confidenceScore ?? 52);
    return {
      type,
      compactLabel: this.compactLabel(type, convictionPct, signal),
      fullLabel: this.fullLabel(type),
      convictionPct,
      rationale: this.rationale(signal, type),
      markerText: `WAIT\n${convictionPct}%`,
      markerColor: this.color(type),
      shape: 'circle',
      position: 'aboveBar',
      promoted: false
    };
  }

  /**
   * Phase 156 — opening drive early participation markers (first 30m, no stats gate).
   */
  private buildDirectOpeningExpansionOverlay(
    signal: TradingSignal,
    legacy: EntryDecisionType
  ): EntryDecisionOverlay | null {
    if (TRAP_TYPES.has(signal.signalType)) return null;
    if (legacy === 'TRAP_RISK') return null;

    const baseDecision = this.legacyToLive(legacy);
    const expansion = this.openingExpansion.evaluateForReplay(signal, baseDecision);
    if (!expansion?.active || !expansion.entryType) return null;

    const entryType = expansion.entryType as EntryDecisionType;
    const convictionPct = Math.min(95, Math.round((signal.confidenceScore ?? 2) * 12 + 52));
    const label = entryTypeMarker(expansion.entryType);
    const reason = expansion.promotionReason;
    const exp = expansion.expectedR != null ? ` · exp ${expansion.expectedR}R` : '';
    const compact = `${label}\n${convictionPct}%${exp}`;

    return {
      type: entryType,
      compactLabel: compact,
      fullLabel: this.fullLabel(entryType),
      convictionPct,
      rationale: reason,
      markerText: compact,
      markerColor: expansionMarkerColor(),
      shape: 'arrowUp',
      position: 'belowBar',
      promoted: true,
      originalDecision: expansion.originalDecision,
      openingExpansion: true,
      openingEntryType: expansion.entryType,
      openingParticipationMode: expansion.participationMode,
      promotionReason: reason,
      expectedR: expansion.expectedR != null ? `+${expansion.expectedR}R` : null
    };
  }

  /**
   * Replay chart markers must be visible without evaluated-history gates.
   * Maps CONT/PULL/MOM setups directly to Phase 155 entry types.
   */
  private buildDirectContinuationOverlay(
    signal: TradingSignal,
    legacy: EntryDecisionType
  ): EntryDecisionOverlay | null {
    if (TRAP_TYPES.has(signal.signalType)) return null;
    const entryType = this.continuationEntryTypeFor(signal.signalType);
    if (!entryType) return null;
    if (legacy === 'TRAP_RISK' || legacy === 'REDUCE_SIZE') return null;

    const convictionPct = Math.min(95, Math.round((signal.confidenceScore ?? 2) * 12 + 48));
    const label = this.shortMarkerLabel(entryType);
    const reason = this.continuationRationale(signal, entryType);
    const compact = `${label}\n${convictionPct}%`;

    return {
      type: entryType,
      compactLabel: compact,
      fullLabel: this.fullLabel(entryType),
      convictionPct,
      rationale: reason,
      markerText: compact,
      markerColor: '#10b981',
      shape: 'arrowUp',
      position: 'belowBar',
      promoted: true,
      originalDecision: this.legacyToLive(legacy),
      continuationEntryType: entryType,
      promotionReason: reason,
      expectedR: null
    };
  }

  private continuationEntryTypeFor(signalType: string): EntryDecisionType | null {
    if (signalType.includes('CONT')) return 'SECOND_LEG_BUY';
    if (signalType.includes('PULL')) return 'VWAP_RECLAIM_BUY';
    if (signalType.includes('MOM')) return 'CONTINUATION_BUY';
    return null;
  }

  /** ASCII-safe chart labels (lightweight-charts strips unicode arrows). */
  private shortMarkerLabel(type: EntryDecisionType): string {
    switch (type) {
      case 'SECOND_LEG_BUY': return '2ND LEG';
      case 'VWAP_RECLAIM_BUY': return 'VWAP RECLAIM';
      case 'CONTINUATION_BUY': return 'CONT BUY';
      case 'DIGESTION_BREAKOUT': return 'DIGESTION';
      case 'TREND_ACCEPTANCE_BUY': return 'TREND ACC';
      case 'PULLBACK_HOLD_ENTRY': return 'PULLBACK HOLD';
      case 'ADD_ON_RECLAIM': return 'ADD RECLAIM';
      case 'OPENING_DRIVE_BUY': return 'OPEN DRIVE';
      case 'EARLY_EXPANSION_BUY': return 'EARLY EXP';
      case 'INSTITUTIONAL_IMBALANCE_BUY': return 'IMBALANCE BUY';
      case 'TREND_DAY_INITIATION': return 'TREND DAY';
      case 'FIRST_PULLBACK_BUY': return 'FIRST PB ADD';
      case 'OPENING_ACCEPTANCE_BUY': return 'OPEN ACC';
      case 'CONTINUATION_ADD': return 'CONT ADD';
      case 'EARLY_EXPANSION_ENTRY': return 'EARLY EXP';
      case 'VWAP_ACCEPTANCE_CONTINUATION': return 'VWAP CONT';
      case 'SHALLOW_PULLBACK_CONTINUATION': return 'SHALLOW PB';
      case 'HIGH_RVOL_CONTINUATION': return 'RVOL CONT';
      case 'PERSISTENCE_ENTRY': return 'PERSISTENCE';
      case 'STRUCTURE_ACCELERATION_ENTRY': return 'STRUCT ACCEL';
      default: return 'CONT BUY';
    }
  }

  private continuationRationale(signal: TradingSignal, type: EntryDecisionType): string {
    if (signal.signalReason) return signal.signalReason.split(' · ')[0];
    switch (type) {
      case 'SECOND_LEG_BUY': return 'Second-leg compression · continuation promotion';
      case 'VWAP_RECLAIM_BUY': return 'VWAP reclaim persistence · continuation promotion';
      case 'CONTINUATION_BUY': return 'Trend continuation accepted · promotion eligible';
      default: return 'Continuation structure · promotion eligible';
    }
  }

  private promotionLabel(entryType: string, conviction: number, expectedR: number | null): string {
    const marker = this.shortMarkerLabel(entryType as EntryDecisionType);
    const exp = expectedR != null ? ` · exp ${expectedR}R` : '';
    return `${marker}\n${conviction}%${exp}`;
  }

  private isContinuationSetup(signalType: string): boolean {
    return signalType.includes('CONT') || signalType.includes('PULL')
      || signalType === 'MOM_READY' || signalType === 'MOM_BUY';
  }

  private legacyToLive(t: EntryDecisionType): LiveExecutionDecision {
    switch (t) {
      case 'FULL_EXECUTION': return 'FULL_EXECUTION';
      case 'PROBING_EXECUTION': return 'PROBING_EXECUTION';
      case 'WAIT_FOR_PULLBACK': return 'WAIT_FOR_PULLBACK';
      case 'REDUCE_SIZE': return 'REDUCE_SIZE';
      case 'TRAP_RISK': return 'TRAP_RISK';
      default: return 'AVOID_TRADE';
    }
  }

  private liveToEntry(d: LiveExecutionDecision, fallback: EntryDecisionType): EntryDecisionType {
    switch (d) {
      case 'FULL_EXECUTION': return 'FULL_EXECUTION';
      case 'PROBING_EXECUTION': return 'PROBING_EXECUTION';
      case 'WAIT_FOR_ACCEPTANCE':
      case 'WAIT_FOR_PULLBACK': return 'WAIT_FOR_PULLBACK';
      case 'REDUCE_SIZE': return 'REDUCE_SIZE';
      case 'TRAP_RISK': return 'TRAP_RISK';
      case 'AVOID_CHASE':
      case 'AVOID_TRADE': return 'AVOID_TRADE';
      default: return fallback;
    }
  }

  private fullLabel(type: EntryDecisionType): string {
    switch (type) {
      case 'FULL_EXECUTION': return 'FULL EXECUTION';
      case 'PROBING_EXECUTION': return 'PROBING EXECUTION';
      case 'WAIT_FOR_PULLBACK': return 'WAIT FOR PULLBACK';
      case 'AVOID_TRADE': return 'AVOID TRADE';
      case 'TRAP_RISK': return 'TRAP RISK';
      case 'REDUCE_SIZE': return 'REDUCE SIZE';
      case 'CONTINUATION_BUY': return 'CONTINUATION BUY';
      case 'VWAP_RECLAIM_BUY': return 'VWAP RECLAIM BUY';
      case 'SECOND_LEG_BUY': return 'SECOND LEG BUY';
      case 'DIGESTION_BREAKOUT': return 'TREND DIGESTION BUY';
      case 'TREND_ACCEPTANCE_BUY': return 'TREND ACCEPTANCE BUY';
      case 'PULLBACK_HOLD_ENTRY': return 'PULLBACK HOLD ENTRY';
      case 'ADD_ON_RECLAIM': return 'ADD ON RECLAIM';
      case 'OPENING_DRIVE_BUY': return 'OPENING DRIVE BUY';
      case 'EARLY_EXPANSION_BUY': return 'EARLY EXPANSION BUY';
      case 'INSTITUTIONAL_IMBALANCE_BUY': return 'INSTITUTIONAL IMBALANCE BUY';
      case 'TREND_DAY_INITIATION': return 'TREND DAY INITIATION';
      case 'FIRST_PULLBACK_BUY': return 'FIRST PULLBACK ADD';
      case 'OPENING_ACCEPTANCE_BUY': return 'OPENING ACCEPTANCE BUY';
    }
    return 'UNKNOWN';
  }

  private compactLabel(type: EntryDecisionType, conviction: number, signal: TradingSignal): string {
    const tag = this.contextTag(signal);
    switch (type) {
      case 'FULL_EXECUTION': return `▲ FULL EXEC\n${conviction}% · ${tag}`;
      case 'PROBING_EXECUTION': return `▲ PROBE\n${conviction}% · ${tag}`;
      case 'WAIT_FOR_PULLBACK': return `WAIT\n${conviction}%`;
      case 'AVOID_TRADE': return `✕ AVOID\n${conviction}%`;
      case 'TRAP_RISK': return `⚠ TRAP\n${conviction}%`;
      case 'REDUCE_SIZE': return `▼ REDUCE\n${conviction}%`;
      case 'CONTINUATION_BUY': return `▲ CONT BUY\n${conviction}%`;
      case 'VWAP_RECLAIM_BUY': return `▲ VWAP RECLAIM\n${conviction}%`;
      case 'SECOND_LEG_BUY': return `▲ 2ND LEG\n${conviction}%`;
      case 'DIGESTION_BREAKOUT': return `▲ DIGESTION\n${conviction}%`;
      case 'TREND_ACCEPTANCE_BUY': return `▲ TREND ACC\n${conviction}%`;
      case 'PULLBACK_HOLD_ENTRY': return `▲ PULLBACK HOLD\n${conviction}%`;
      case 'ADD_ON_RECLAIM': return `▲ ADD RECLAIM\n${conviction}%`;
      case 'OPENING_DRIVE_BUY': return `OPEN DRIVE\n${conviction}%`;
      case 'EARLY_EXPANSION_BUY': return `EARLY EXP\n${conviction}%`;
      case 'INSTITUTIONAL_IMBALANCE_BUY': return `IMBALANCE BUY\n${conviction}%`;
      case 'TREND_DAY_INITIATION': return `TREND DAY\n${conviction}%`;
      case 'FIRST_PULLBACK_BUY': return `FIRST PB ADD\n${conviction}%`;
      case 'OPENING_ACCEPTANCE_BUY': return `OPEN ACC\n${conviction}%`;
    }
    return `WAIT\n${conviction}%`;
  }

  private contextTag(signal: TradingSignal): string {
    if (signal.signalType.includes('PULL') || signal.signalReason?.toLowerCase().includes('reclaim')) return 'RECLAIM';
    if (signal.signalType.includes('CONT')) return '2ND LEG';
    if (signal.signalType.includes('MOM')) return 'MOMENTUM';
    if (signal.signalType.includes('OPEN')) return 'OPEN';
    return 'ENTRY';
  }

  private rationale(signal: TradingSignal, type: EntryDecisionType): string {
    if (signal.signalReason) return signal.signalReason.split(' · ')[0];
    switch (type) {
      case 'FULL_EXECUTION': return 'Institutional reclaim accepted · low fakeout risk';
      case 'PROBING_EXECUTION': return 'Valid structure · size reduced until confirmation';
      case 'WAIT_FOR_PULLBACK': return 'Setup forming · wait for alignment';
      case 'TRAP_RISK': return 'Trap location · avoid entry';
      case 'REDUCE_SIZE': return 'Extended location · reduce size';
      default: return 'Conditions not aligned for full execution';
    }
  }

  private color(type: EntryDecisionType): string {
    switch (type) {
      case 'FULL_EXECUTION':
      case 'CONTINUATION_BUY':
      case 'VWAP_RECLAIM_BUY':
      case 'SECOND_LEG_BUY':
      case 'DIGESTION_BREAKOUT':
      case 'TREND_ACCEPTANCE_BUY':
      case 'PULLBACK_HOLD_ENTRY':
      case 'ADD_ON_RECLAIM':
        return '#10b981';
      case 'OPENING_DRIVE_BUY':
      case 'EARLY_EXPANSION_BUY':
      case 'INSTITUTIONAL_IMBALANCE_BUY':
      case 'TREND_DAY_INITIATION':
      case 'FIRST_PULLBACK_BUY':
      case 'OPENING_ACCEPTANCE_BUY':
        return expansionMarkerColor();
      case 'CONTINUATION_ADD':
      case 'EARLY_EXPANSION_ENTRY':
      case 'VWAP_ACCEPTANCE_CONTINUATION':
      case 'SHALLOW_PULLBACK_CONTINUATION':
      case 'HIGH_RVOL_CONTINUATION':
      case 'PERSISTENCE_ENTRY':
        return participationMarkerColor();
      case 'STRUCTURE_ACCELERATION_ENTRY':
        return autonomousMarkerColor();
      case 'PROBING_EXECUTION': return '#38bdf8';
      case 'WAIT_FOR_PULLBACK': return '#94a3b8';
      case 'REDUCE_SIZE': return '#fbbf24';
      case 'TRAP_RISK': return '#ef5350';
      case 'AVOID_TRADE': return '#6e7681';
    }
    return '#94a3b8';
  }

  private inferScore(signal: TradingSignal, type: EntryDecisionType): number {
    switch (type) {
      case 'FULL_EXECUTION':
      case 'SECOND_LEG_BUY':
      case 'VWAP_RECLAIM_BUY':
      case 'OPENING_DRIVE_BUY':
      case 'EARLY_EXPANSION_BUY':
      case 'INSTITUTIONAL_IMBALANCE_BUY':
        return 82;
      case 'PROBING_EXECUTION':
      case 'CONTINUATION_BUY':
        return 68;
      case 'WAIT_FOR_PULLBACK': return 52;
      case 'REDUCE_SIZE': return 58;
      case 'TRAP_RISK': return 35;
      default: return 40;
    }
  }
}
