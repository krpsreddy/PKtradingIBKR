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
import { TradingSignal } from '../../../models/signal.model';
import { decisionForSignal } from '../adaptive-calibration/adaptive-calibration.util';
import {
  OpeningExpansionInput,
  OpeningExpansionOverlay,
  OpeningExpansionReport,
  OpeningParticipationMode
} from './opening-expansion.models';
import { InstitutionalOpeningDriveEngine } from './institutional-opening-drive.engine';
import { EarlyExpansionQualificationEngine } from './early-expansion-qualification.engine';
import { FirstPullbackOpportunityEngine } from './first-pullback-opportunity.engine';
import { TrendDayPersistenceEngine } from './trend-day-persistence.engine';
import {
  QCOM_CASE_STUDIES,
  OPENING_WINDOW_MIN,
  expansionMarkerColor,
  entryTypeLabel,
  entryTypeMarker,
  inputFromSignal,
  isOpeningSignal,
  isOpeningTrap,
  isPromotableExpansion,
  mapModeToEntryType,
  mfeR,
  sessionDateFromTs
} from './opening-expansion.util';

/** Phase 156 — opening drive expansion & early participation orchestrator (advisory only). */
@Injectable({ providedIn: 'root' })
export class ExpansionParticipationSynthesisService {
  private readonly driveEngine = new InstitutionalOpeningDriveEngine();
  private readonly qualifyEngine = new EarlyExpansionQualificationEngine();
  private readonly pullbackEngine = new FirstPullbackOpportunityEngine();
  private readonly persistenceEngine = new TrendDayPersistenceEngine();

  private archetypesCache: ReturnType<InstitutionalOpeningDriveEngine['analyzeSessions']> = [];

  private readonly reportSubject = new BehaviorSubject<OpeningExpansionReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(private store: SignalIntelligenceStore) {
    this.store.revision$.subscribe(() => this.refresh());
    this.refresh();
  }

  snapshot(): OpeningExpansionReport | null {
    return this.reportSubject.value;
  }

  refresh(lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS, filter: SignalIntelligenceFilter = {}): OpeningExpansionReport {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs }).filter(isEvaluatedSignal);
    this.archetypesCache = this.driveEngine.analyzeSessions(signals);

    const candidates = this.buildEarlyCandidates(signals);
    const missed = this.buildMissedWinners(signals);

    const report: OpeningExpansionReport = {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: Date.now(),
      sampleCount: signals.length,
      institutionalExpansionDays: this.archetypesCache
        .filter(a => a.label === 'INSTITUTIONAL_EXPANSION')
        .map(a => ({ ...a, label: 'Institutional expansion', promotable: isPromotableExpansion(a) })),
      retailExhaustionDays: this.archetypesCache
        .filter(a => a.label === 'RETAIL_EXHAUSTION')
        .map(a => ({ ...a, label: 'Retail exhaustion', promotable: false })),
      earlyParticipationCandidates: candidates.slice(0, 20),
      missedOpeningWinners: missed.slice(0, 20),
      firstPullbackAdds: this.pullbackEngine.analyze(signals).map(a => ({
        ...a,
        promotable: isPromotableExpansion(a)
      })),
      trendDayPersistence: this.persistenceEngine.analyze(signals),
      caseStudies: QCOM_CASE_STUDIES,
      summaryInsights: this.buildInsights(signals.length, candidates.length, missed.length)
    };

    this.reportSubject.next(report);
    return report;
  }

  /** Replay/live chart — early participation without evaluated-history gate. */
  evaluateForReplay(
    signal: TradingSignal,
    originalDecision: LiveExecutionDecision
  ): OpeningExpansionOverlay | null {
    const input = inputFromSignal(signal, this.store.query({ symbol: (signal.symbol ?? 'UNK').toUpperCase() }).length);
    if (!this.isEligible(input)) return null;

    const classification = this.driveEngine.classify(input);
    if (classification === 'RETAIL_EXHAUSTION' || isOpeningTrap(input.signalType)) return null;

    const qual = this.qualifyEngine.qualify(input);
    let mode = this.resolveMode(input, qual.score, classification);
    if (mode === 'NONE' && qual.score >= 45 && isOpeningSignal(input.signalType)) {
      mode = 'PROBING_OPEN';
    }
    if (mode === 'NONE' && this.pullbackEngine.isFirstPullbackAdd(input)) {
      mode = 'FIRST_PULLBACK_ADD';
    }
    if (mode === 'NONE') return null;

    const entryType = mapModeToEntryType(mode, input);
    const promotedDecision = this.resolvePromotedDecision(originalDecision, mode, qual.score);

    return {
      active: true,
      classification,
      participationMode: mode,
      entryType,
      originalDecision,
      promotedDecision,
      promotionReason: this.promotionReason(mode, qual),
      persistencePct: this.persistenceEngine.persistenceScore(input),
      followThroughPct: qual.followThroughProb,
      statsBacked: false,
      expectedR: qual.score >= 70 ? 2.4 : 1.5,
      advisoryOnly: true
    };
  }

  applyToLiveDecision(
    snapshot: LiveExecutionDecisionSnapshot,
    input: OpeningExpansionInput
  ): LiveExecutionDecisionSnapshot {
    const overlay = this.promote(snapshot.decision, input);
    if (!overlay.active || !overlay.entryType) return { ...snapshot, openingExpansion: overlay };

    return {
      ...snapshot,
      decision: overlay.promotedDecision,
      decisionLabel: entryTypeLabel(overlay.entryType),
      keyReason: overlay.promotionReason,
      compactLine: `${entryTypeLabel(overlay.entryType)} · ${snapshot.conviction.label}`,
      detailLine: `Early participation · ${overlay.participationMode.replace(/_/g, ' ')}`,
      openingExpansion: overlay
    };
  }

  promote(originalDecision: LiveExecutionDecision, input: OpeningExpansionInput): OpeningExpansionOverlay {
    const classification = this.driveEngine.classify(input);
    const qual = this.qualifyEngine.qualify(input);
    const none: OpeningExpansionOverlay = {
      active: false,
      classification,
      participationMode: 'NONE',
      entryType: null,
      originalDecision,
      promotedDecision: originalDecision,
      promotionReason: '',
      persistencePct: null,
      followThroughPct: qual.followThroughProb,
      statsBacked: false,
      expectedR: null,
      advisoryOnly: true
    };

    if (classification === 'RETAIL_EXHAUSTION') return none;
    if (isOpeningTrap(input.signalType)) return none;

    const mode = this.resolveMode(input, qual.score, classification);
    if (mode === 'NONE') return none;

    const entryType = mapModeToEntryType(mode, input);
    const promotedDecision = this.resolvePromotedDecision(originalDecision, mode, qual.score);
    if (promotedDecision === originalDecision && !isWaitOrAvoid(originalDecision)) {
      return { ...none, active: mode === 'OPENING_DRIVE_FULL', entryType, participationMode: mode };
    }

    const archetype = this.archetypesCache.find(a => a.label === 'INSTITUTIONAL_EXPANSION');
    const statsOk = archetype ? isPromotableExpansion(archetype) : qual.institutional || qual.score >= 50;

    if (!statsOk && classification !== 'INSTITUTIONAL_EXPANSION' && qual.score < 55) return none;
    if (promotedDecision === originalDecision && !isWaitOrAvoid(originalDecision)) return none;

    return {
      active: true,
      classification,
      participationMode: mode,
      entryType,
      originalDecision,
      promotedDecision,
      promotionReason: this.promotionReason(mode, qual, archetype),
      persistencePct: this.persistenceEngine.persistenceScore(input),
      followThroughPct: qual.followThroughProb,
      statsBacked: !!archetype && isPromotableExpansion(archetype),
      expectedR: archetype ? archetype.avgR : qual.score >= 70 ? 2.4 : 1.5,
      advisoryOnly: true
    };
  }

  markerLabel(entryType: import('./opening-expansion.models').OpeningExpansionEntryType): string {
    return entryTypeMarker(entryType);
  }

  markerColor(): string {
    return expansionMarkerColor();
  }

  private isEligible(input: OpeningExpansionInput): boolean {
    if ((input.sessionTimeMinutes ?? 999) > OPENING_WINDOW_MIN) return false;
    if (isOpeningTrap(input.signalType)) return false;
    return isOpeningSignal(input.signalType)
      || this.pullbackEngine.isFirstPullbackAdd(input);
  }

  private resolveMode(
    input: OpeningExpansionInput,
    qualScore: number,
    classification: string
  ): OpeningParticipationMode {
    if (this.pullbackEngine.isFirstPullbackAdd(input)) return 'FIRST_PULLBACK_ADD';
    if (classification === 'INSTITUTIONAL_EXPANSION' && qualScore >= 70) return 'OPENING_DRIVE_FULL';
    if (qualScore >= 55 || classification === 'CONTROLLED_DIGESTION') return 'PROBING_OPEN';
    if (qualScore >= 45 && isOpeningSignal(input.signalType)) return 'PROBING_OPEN';
    return 'NONE';
  }

  private resolvePromotedDecision(
    original: LiveExecutionDecision,
    mode: OpeningParticipationMode,
    qualScore: number
  ): LiveExecutionDecision {
    if (mode === 'OPENING_DRIVE_FULL') return 'FULL_EXECUTION';
    if (mode === 'FIRST_PULLBACK_ADD') return qualScore >= 65 ? 'FULL_EXECUTION' : 'PROBING_EXECUTION';
    if (mode === 'PROBING_OPEN') return 'PROBING_EXECUTION';
    return original;
  }

  private promotionReason(
    mode: OpeningParticipationMode,
    qual: ReturnType<EarlyExpansionQualificationEngine['qualify']>,
    archetype?: { winRate: number; avgR: number; count: number; continuationPct: number; fakeoutPct: number }
  ): string {
    if (archetype && isPromotableExpansion(archetype)) {
      return `Opening expansion archetype: WR ${archetype.winRate}% · +${archetype.avgR}R · n=${archetype.count}`;
    }
    switch (mode) {
      case 'OPENING_DRIVE_FULL': return 'Institutional opening expansion · sustained RVOL + ORB acceptance';
      case 'FIRST_PULLBACK_ADD': return 'First controlled pullback add on trend day';
      case 'PROBING_OPEN': return `Early expansion probe · follow-through ${qual.followThroughProb}%`;
      default: return 'Opening participation eligible';
    }
  }

  private buildEarlyCandidates(signals: SignalSnapshot[]) {
    const out: OpeningExpansionReport['earlyParticipationCandidates'] = [];
    const n = signals.length;
    for (const s of signals) {
      if ((s.sessionTimeMinutes ?? 999) >= OPENING_WINDOW_MIN) continue;
      const input = snapshotInput(s, n);
      const base = decisionForSignal(s, n).decision;
      const promo = this.promote(base, input);
      if (!promo.active || !promo.entryType) continue;
      out.push({
        symbol: s.symbol,
        sessionDate: sessionDateFromTs(s.timestamp),
        signalType: s.signalType,
        originalDecision: base,
        entryType: promo.entryType,
        outcomeR: mfeR(s),
        mode: promo.participationMode
      });
    }
    return out.sort((a, b) => b.outcomeR - a.outcomeR);
  }

  private buildMissedWinners(signals: SignalSnapshot[]) {
    return this.buildEarlyCandidates(signals)
      .filter(c => c.outcomeR >= 2 && (c.originalDecision.includes('WAIT') || c.originalDecision.includes('AVOID')))
      .map(c => ({
        symbol: c.symbol,
        sessionDate: c.sessionDate,
        waitDecision: c.originalDecision,
        outcomeR: c.outcomeR,
        wouldEntry: c.entryType
      }));
  }

  private buildInsights(sampleCount: number, promoted: number, missed: number): string[] {
    const lines: string[] = [];
    if (sampleCount < 10) lines.push('Insufficient sample — hydrate before trusting opening expansion stats.');
    const inst = this.archetypesCache.find(a => a.label === 'INSTITUTIONAL_EXPANSION');
    if (inst) lines.push(`Institutional expansion days: WR ${inst.winRate}% · +${inst.avgR}R · n=${inst.count}`);
    lines.push(`${promoted} opening signals qualify for early participation under Phase 156.`);
    lines.push(`${missed} historical +2R winners were WAIT/AVOID at the open — governance suppression reduced.`);
    lines.push('Advisory only — no auto-trading or threshold mutation.');
    return lines;
  }
}

function isWaitOrAvoid(d: LiveExecutionDecision): boolean {
  return d.includes('WAIT') || d.includes('AVOID') || d === 'REDUCE_SIZE';
}

function snapshotInput(s: SignalSnapshot, n: number): OpeningExpansionInput {
  return {
    symbol: s.symbol,
    signalType: s.signalType,
    sessionTimeMinutes: s.sessionTimeMinutes,
    rvol: s.rvol,
    vwapDistance: s.vwapDistance,
    trendAlignment: s.trendAlignment,
    extended: s.extendedEntry,
    score: s.convictionScore ?? undefined,
    marketRegime: s.marketRegime,
    sampleCount: n
  };
}
