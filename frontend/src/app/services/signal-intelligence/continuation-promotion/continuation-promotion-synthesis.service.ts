import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter,
  SignalSnapshot
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { isEvaluatedSignal } from '../signal-intelligence.math';
import { LiveExecutionDecision, LiveExecutionDecisionSnapshot } from '../live-decision/live-decision.models';
import {
  ContinuationPromotionInput,
  ContinuationPromotionOverlay,
  ContinuationPromotionReport
} from './continuation-promotion.models';
import { EliteContinuationProfileEngine } from './elite-continuation-profile.engine';
import { ContinuationGovernanceRebalanceEngine } from './continuation-governance-rebalance.engine';
import { ContinuationVsExhaustionEngine } from './continuation-vs-exhaustion.engine';
import { InstitutionalReclaimPromotionEngine } from './institutional-reclaim-promotion.engine';
import { TrendPersistenceConfidenceEngine } from './trend-persistence-confidence.engine';
import { HealthyContinuationEngine } from './healthy-continuation-engine';
import { decisionForSignal } from '../adaptive-calibration/adaptive-calibration.util';
import { ContinuationAcceptanceEngine } from '../entry-sequencing/continuation-acceptance.engine';
import { PullbackStabilityEngine } from '../entry-sequencing/pullback-stability.engine';
import { EntryAcceptanceSequencingEngine } from '../entry-sequencing/entry-acceptance-sequencing.engine';
import {
  ContinuationAcceptanceLevel,
  EntryAcceptanceState,
  LiveEntrySequencingInput,
  PullbackStabilityLevel
} from '../entry-sequencing/entry-sequencing.models';
import {
  mapClassificationToEntryType,
  mfeR,
  sessionDateFromTs
} from './continuation-promotion.util';
import { TradingSignal } from '../../../models/signal.model';
import { inputFromSignal, isContinuationPrecursor } from './continuation-promotion.util';

/** Phase 155 — continuation promotion orchestrator (advisory only). */
@Injectable({ providedIn: 'root' })
export class ContinuationPromotionSynthesisService {
  private readonly eliteEngine = new EliteContinuationProfileEngine();
  private readonly rebalanceEngine = new ContinuationGovernanceRebalanceEngine();
  private readonly vsExhaustion = new ContinuationVsExhaustionEngine();
  private readonly reclaimEngine = new InstitutionalReclaimPromotionEngine();
  private readonly trendEngine = new TrendPersistenceConfidenceEngine();
  private readonly healthyEngine = new HealthyContinuationEngine();
  private readonly continuationEngine = new ContinuationAcceptanceEngine();
  private readonly pullbackEngine = new PullbackStabilityEngine();
  private readonly sequencer = new EntryAcceptanceSequencingEngine();

  private archetypesCache: ReturnType<EliteContinuationProfileEngine['analyze']> = [];

  private readonly reportSubject = new BehaviorSubject<ContinuationPromotionReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(private store: SignalIntelligenceStore) {
    this.store.revision$.subscribe(() => this.refresh());
    this.refresh();
  }

  snapshot(): ContinuationPromotionReport | null {
    return this.reportSubject.value;
  }

  refresh(lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS, filter: SignalIntelligenceFilter = {}): ContinuationPromotionReport {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs }).filter(isEvaluatedSignal);
    this.archetypesCache = this.eliteEngine.analyze(signals);

    const promotionCandidates = this.buildPromotionCandidates(signals);
    const reclassified = this.buildReclassifiedWinners(signals);

    const report: ContinuationPromotionReport = {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: Date.now(),
      sampleCount: signals.length,
      eliteArchetypes: this.archetypesCache.slice(0, 12),
      promotedContinuationProfiles: this.buildPromotedProfiles(),
      healthyContinuationStats: this.buildHealthyStats(signals),
      continuationVsExhaustion: this.buildVsExhaustion(signals),
      promotionCandidates: promotionCandidates.slice(0, 20),
      governancePenaltyFailures: this.buildPenaltyFailures(signals),
      reclassifiedWinners: reclassified.slice(0, 20),
      trendPersistenceAnalytics: this.trendEngine.analyze(signals),
      institutionalReclaimStats: this.reclaimEngine.stats(signals),
      trendDigestionWinners: reclassified.slice(0, 10).map(r => ({
        symbol: r.symbol,
        sessionDate: r.sessionDate,
        outcomeR: r.outcomeR,
        classification: r.toClassification,
        entryType: mapClassificationToEntryType(r.toClassification)
      })),
      summaryInsights: this.buildInsights(signals.length, promotionCandidates.length)
    };

    this.reportSubject.next(report);
    return report;
  }

  /** Apply statistical promotion overlay to a live decision snapshot. */
  applyToLiveDecision(
    snapshot: LiveExecutionDecisionSnapshot,
    input: ContinuationPromotionInput
  ): LiveExecutionDecisionSnapshot {
    const promotion = this.rebalanceEngine.promote(snapshot.decision, input, this.archetypesCache);
    if (!promotion.active) return { ...snapshot, continuationPromotion: promotion };

    const label = this.promotedLabel(promotion.promotedDecision, promotion.continuationEntryType);
    return {
      ...snapshot,
      decision: promotion.promotedDecision,
      decisionLabel: label,
      keyReason: promotion.promotionReason,
      compactLine: `${label} · ${snapshot.conviction.label}`,
      detailLine: `${promotion.suppressionOverride} · ${snapshot.riskLabel}`,
      continuationPromotion: promotion
    };
  }

  /** Promote replay/live trading signal to chart-visible continuation entry. */
  promoteSignal(
    signal: TradingSignal,
    baseDecision: LiveExecutionDecision,
    sampleCount?: number
  ): ContinuationPromotionOverlay {
    const n = sampleCount ?? this.store.query({ symbol: (signal.symbol ?? 'UNK').toUpperCase() }).length;
    const input = this.enrichInput(inputFromSignal(signal, n), signal);
    return this.rebalanceEngine.promote(baseDecision, input, this.archetypesCache);
  }

  inputFromSnapshot(s: SignalSnapshot, sampleCount: number): ContinuationPromotionInput {
    const seq = this.sequencer.sequence(s, sampleCount);
    return {
      symbol: s.symbol,
      signalType: s.signalType,
      marketRegime: s.marketRegime,
      rvol: s.rvol,
      trendAlignment: s.trendAlignment,
      vwapDistance: s.vwapDistance,
      sessionTimeMinutes: s.sessionTimeMinutes,
      extended: s.extendedEntry,
      sequencingState: seq.finalState,
      continuationAcceptance: this.continuationEngine.classify(s),
      pullbackStability: this.pullbackEngine.classify(s),
      fakeoutRisk: s.evaluation?.maeR != null && s.evaluation.maeR <= -1 ? 'HIGH' : 'LOW',
      sampleCount
    };
  }

  private enrichInput(base: ContinuationPromotionInput, signal: TradingSignal): ContinuationPromotionInput {
    const seqInput: LiveEntrySequencingInput = {
      symbol: base.symbol,
      signalType: signal.signalType,
      rvol: signal.relativeVolume ?? base.rvol,
      trendAlignment: signal.confidenceScore ?? base.trendAlignment,
      vwapDistance: base.vwapDistance,
      extended: signal.extended ?? base.extended,
      sessionTimeMinutes: base.sessionTimeMinutes ?? this.sessionMinutesFromTs(signal.timestamp)
    };
    const snapshot = this.sequencer.buildSnapshot(seqInput);
    const sequencingState = this.sequencer.liveState(seqInput);
    const continuationAcceptance = this.continuationEngine.classify(snapshot);
    const pullbackStability = this.pullbackEngine.classify(snapshot);
    const inferred = this.inferReplayPromotionHints(
      signal,
      continuationAcceptance,
      pullbackStability,
      sequencingState
    );

    return {
      ...base,
      signalType: signal.signalType,
      extended: signal.extended ?? base.extended,
      trendAlignment: seqInput.trendAlignment,
      rvol: seqInput.rvol,
      sessionTimeMinutes: seqInput.sessionTimeMinutes,
      sequencingState: inferred.sequencingState,
      continuationAcceptance: inferred.continuationAcceptance,
      pullbackStability: inferred.pullbackStability,
      fakeoutRisk: inferred.fakeoutRisk
    };
  }

  private sessionMinutesFromTs(ts: string): number | undefined {
    const parsed = Date.parse(ts);
    if (!Number.isFinite(parsed)) return undefined;
    const d = new Date(parsed);
    const et = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    return et.getHours() * 60 + et.getMinutes() - 9 * 60 - 30;
  }

  /** Replay/live chart signals lack evaluation windows — infer continuation context from setup type. */
  private inferReplayPromotionHints(
    signal: TradingSignal,
    continuation: ContinuationAcceptanceLevel,
    pullback: PullbackStabilityLevel,
    sequencing: EntryAcceptanceState
  ): {
    continuationAcceptance: ContinuationAcceptanceLevel;
    pullbackStability: PullbackStabilityLevel;
    sequencingState: EntryAcceptanceState;
    fakeoutRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  } {
    const t = signal.signalType;
    const score = signal.confidenceScore ?? 50;
    let cont = continuation;
    let pull = pullback;
    let seq = sequencing;
    const trap = t.includes('FAIL') || t.includes('IMBALANCE_DOWN');
    const fakeoutRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' =
      trap || score < 30 ? 'HIGH' : score < 45 ? 'MEDIUM' : 'LOW';

    if (t.includes('CONT')) {
      if (cont === 'FAILING_ACCEPTANCE') cont = 'WEAK_ACCEPTANCE';
      if (seq === 'INITIAL_TRIGGER' || seq === 'WAITING_FOR_ACCEPTANCE' || seq === 'EARLY_EXTENSION') {
        seq = score >= 62 ? 'CONTINUATION_ACCEPTED' : 'PULLBACK_STABILIZING';
      }
      if (pull === 'UNSTABLE' || pull === 'FAILING') pull = 'STABLE';
    }

    if (t.includes('PULL')) {
      if (pull === 'UNSTABLE' || pull === 'FAILING') pull = 'STABLE';
      if (seq !== 'FAILED_ACCEPTANCE' && seq !== 'REJECTED') seq = 'RECLAIM_CONFIRMED';
      if (cont === 'FAILING_ACCEPTANCE') cont = 'NEUTRAL_ACCEPTANCE';
    }

    if (t.includes('MOM')) {
      if (cont === 'FAILING_ACCEPTANCE') cont = 'NEUTRAL_ACCEPTANCE';
      if (pull === 'UNSTABLE' || pull === 'FAILING') pull = 'STABLE';
      if (t.endsWith('_READY') || t.endsWith('_BUY')) {
        seq = score >= 4 ? 'CONTINUATION_ACCEPTED' : 'PULLBACK_STABILIZING';
      }
    }

    return { continuationAcceptance: cont, pullbackStability: pull, sequencingState: seq, fakeoutRisk };
  }

  private buildPromotedProfiles() {
    return this.archetypesCache
      .filter(a => a.promotable)
      .slice(0, 8)
      .map(a => ({
        profile: a.archetype,
        classification: a.archetype.includes('SECOND') ? 'SECOND_LEG_ACCEPTANCE' as const
          : a.archetype.includes('VWAP') || a.archetype.includes('RECLAIM') ? 'INSTITUTIONAL_RECLAIM' as const
          : 'HEALTHY_CONTINUATION' as const,
        entryType: mapClassificationToEntryType(
          a.archetype.includes('SECOND') ? 'SECOND_LEG_ACCEPTANCE'
            : a.archetype.includes('VWAP') ? 'INSTITUTIONAL_RECLAIM'
            : 'HEALTHY_CONTINUATION'
        ),
        count: a.count,
        winRate: a.winRate,
        avgR: a.avgR,
        confidence: a.confidence,
        promotionReason: `WR ${a.winRate}% · avg +${a.avgR}R · n=${a.count}`
      }));
  }

  private buildHealthyStats(signals: SignalSnapshot[]) {
    const healthy = signals.filter(s => this.healthyEngine.isHealthy(this.inputFromSnapshot(s, signals.length)));
    const wins = healthy.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5).length;
    return [{
      label: 'Healthy continuation digestion',
      classification: 'HEALTHY_CONTINUATION' as const,
      count: healthy.length,
      winRate: healthy.length ? Math.round((wins / healthy.length) * 100) : 0,
      avgR: healthy.length ? Math.round(healthy.reduce((n, s) => n + mfeR(s), 0) / healthy.length * 100) / 100 : 0,
      confidence: healthy.length >= 50 ? 'HIGH' as const : healthy.length >= 25 ? 'MODERATE' as const : 'LOW' as const
    }];
  }

  private buildVsExhaustion(signals: SignalSnapshot[]) {
    const map = new Map<string, SignalSnapshot[]>();
    for (const s of signals) {
      const input = this.inputFromSnapshot(s, signals.length);
      const c = this.vsExhaustion.classify(input);
      const bucket = map.get(c) ?? [];
      bucket.push(s);
      map.set(c, bucket);
    }
    return [...map.entries()].map(([label, rows]) => {
      const wins = rows.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5).length;
      return {
        label,
        classification: label as import('./continuation-promotion.models').ContinuationClassification,
        count: rows.length,
        avgR: rows.length ? Math.round(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length * 100) / 100 : 0,
        winRate: rows.length ? Math.round((wins / rows.length) * 100) : 0,
        promotable: label !== 'TRUE_EXHAUSTION' && label !== 'FAILED_CONTINUATION' && label !== 'LATE_EXTENSION'
      };
    }).sort((a, b) => b.avgR - a.avgR);
  }

  private buildPromotionCandidates(signals: SignalSnapshot[]) {
    const out: ContinuationPromotionReport['promotionCandidates'] = [];
    const n = signals.length;
    for (const s of signals) {
      if (mfeR(s) < 2) continue;
      const input = this.inputFromSnapshot(s, n);
      const base = decisionForSignal(s, n).decision;
      const promo = this.rebalanceEngine.promote(base, input, this.archetypesCache);
      if (!promo.active) continue;
      out.push({
        symbol: s.symbol,
        sessionDate: sessionDateFromTs(s.timestamp),
        originalDecision: base,
        promotedDecision: promo.promotedDecision,
        entryType: promo.continuationEntryType!,
        classification: promo.classification,
        outcomeR: mfeR(s),
        reason: promo.promotionReason
      });
    }
    return out.sort((a, b) => b.outcomeR - a.outcomeR);
  }

  private buildReclassifiedWinners(signals: SignalSnapshot[]) {
    return this.buildPromotionCandidates(signals).map(c => ({
      symbol: c.symbol,
      sessionDate: c.sessionDate,
      fromClassification: 'EXHAUSTED/AVOID',
      toClassification: c.classification,
      outcomeR: c.outcomeR,
      originalDecision: c.originalDecision,
      promotedDecision: c.promotedDecision
    }));
  }

  private buildPenaltyFailures(signals: SignalSnapshot[]) {
    const penalties = [
      { penalty: 'Weak acceptance over-penalized', match: (s: SignalSnapshot) => this.continuationEngine.classify(s) === 'WEAK_ACCEPTANCE' && mfeR(s) >= 2 },
      { penalty: 'Continuation wait bias', match: (s: SignalSnapshot) => decisionForSignal(s, signals.length).decision.includes('WAIT') && mfeR(s) >= 2 },
      { penalty: 'Exhausted mislabel on digestion', match: (s: SignalSnapshot) => s.extendedEntry && mfeR(s) >= 2.5 }
    ];
    return penalties.map(({ penalty, match }) => {
      const rows = signals.filter(match);
      return {
        penalty,
        count: rows.length,
        avgMissedR: rows.length ? Math.round(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length * 100) / 100 : 0,
        confidence: rows.length >= 50 ? 'HIGH' as const : rows.length >= 10 ? 'LOW' as const : 'INSUFFICIENT' as const
      };
    }).filter(r => r.count > 0);
  }

  private buildInsights(sampleCount: number, promoted: number) {
    const top = this.archetypesCache.find(a => a.promotable);
    const lines: string[] = [];
    if (sampleCount < 10) lines.push('Insufficient sample — hydrate before trusting promotion.');
    if (top) lines.push(`Elite archetype: ${top.archetype} — WR ${top.winRate}% · +${top.avgR}R · n=${top.count}`);
    lines.push(`${promoted} historically profitable signals would upgrade from WAIT/AVOID under continuation promotion.`);
    lines.push('Advisory only — no auto-trading or threshold mutation.');
    return lines;
  }

  private promotedLabel(decision: LiveExecutionDecision, entryType: import('./continuation-promotion.models').ContinuationEntryType | null): string {
    if (entryType) return entryType.replace(/_/g, ' ');
    if (decision === 'FULL_EXECUTION') return 'FULL EXECUTION';
    if (decision === 'PROBING_EXECUTION') return 'PROBING EXECUTION';
    return decision.replace(/_/g, ' ');
  }
}
