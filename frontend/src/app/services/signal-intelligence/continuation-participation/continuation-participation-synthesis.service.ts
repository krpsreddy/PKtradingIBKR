import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import { AutonomousDiscoverySynthesisService } from '../autonomous-discovery/autonomous-discovery-synthesis.service';
import { RobustnessValidationSynthesisService } from '../robustness-validation/robustness-validation-synthesis.service';
import { LiveExecutionDecision, LiveExecutionDecisionSnapshot } from '../live-decision/live-decision.models';
import { TradingSignal } from '../../../models/signal.model';
import { decisionForSignal } from '../adaptive-calibration/adaptive-calibration.util';
import {
  ContinuationParticipationInput,
  ContinuationParticipationOverlay,
  ContinuationParticipationReport,
  ContinuationParticipationSignalType
} from './continuation-participation.models';
import { ParticipationConfidenceEngine } from './participation-confidence.engine';
import { GovernanceSuppressionRelaxationEngine } from './governance-suppression-relaxation.engine';
import { ContinuationRiskBalanceEngine } from './continuation-risk-balance.engine';
import { PullbackContinuationEngine } from './pullback-continuation-engine';
import { VwapAcceptanceContinuationEngine } from './vwap-acceptance-continuation.engine';
import { EarlyExpansionWindowEngine } from './early-expansion-window.engine';
import { ContinuationAddEngine } from './continuation-add-engine';
import { ExpansionParticipationEngine } from './expansion-participation-engine';
import {
  confidenceTier,
  inputFromSignal,
  inputFromSnapshot,
  isWaitOrSuppress,
  mfeR,
  sessionDateFromTs
} from './continuation-participation.util';

/** Phase 159 — continuation participation orchestrator (advisory only). */
@Injectable({ providedIn: 'root' })
export class ContinuationParticipationSynthesisService {
  private readonly confidence = new ParticipationConfidenceEngine();
  private readonly governance = new GovernanceSuppressionRelaxationEngine();
  private readonly risk = new ContinuationRiskBalanceEngine();
  private readonly pull = new PullbackContinuationEngine();
  private readonly vwap = new VwapAcceptanceContinuationEngine();
  private readonly early = new EarlyExpansionWindowEngine();
  private readonly add = new ContinuationAddEngine();
  private readonly expansion = new ExpansionParticipationEngine();

  private readonly reportSubject = new BehaviorSubject<ContinuationParticipationReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(
    private store: SignalIntelligenceStore,
    private discovery: AutonomousDiscoverySynthesisService,
    private robustness: RobustnessValidationSynthesisService
  ) {
    this.store.revision$.subscribe(() => this.refresh());
    this.refresh();
  }

  snapshot(): ContinuationParticipationReport | null {
    return this.reportSubject.value;
  }

  refresh(lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS, filter: SignalIntelligenceFilter = {}): ContinuationParticipationReport {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = evaluatedSignals(this.store.query({ ...filter, fromTs }));
    const n = signals.length;
    const discoveryReport = this.discovery.snapshot();

    const recoveries: ContinuationParticipationReport['suppressionRecoveries'] = [];
    const signalBuckets = new Map<ContinuationParticipationSignalType, typeof signals>();

    for (const s of signals) {
      const input = inputFromSnapshot(s, n);
      const base = decisionForSignal(s, n).decision;
      const overlay = this.buildOverlay(base, input);
      if (!overlay.active || !overlay.signalType) continue;
      signalBuckets.set(overlay.signalType, [...(signalBuckets.get(overlay.signalType) ?? []), s]);
      if (isWaitOrSuppress(base) && mfeR(s) >= 1.5) {
        recoveries.push({
          symbol: s.symbol,
          sessionDate: sessionDateFromTs(s.timestamp),
          wasDecision: base,
          participationSignal: overlay.signalType,
          recoveredR: mfeR(s)
        });
      }
    }

    const participationSignals = [...signalBuckets.entries()].map(([signalType, rows]) => {
      const wins = rows.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5);
      const cont = rows.filter(s => mfeR(s) >= 1);
      return {
        signalType,
        count: rows.length,
        winRate: pct(wins.length, rows.length),
        avgR: rows.length ? Math.round(rows.reduce((sum, s) => sum + mfeR(s), 0) / rows.length * 100) / 100 : 0,
        fakeoutPct: 0,
        continuationPct: pct(cont.length, rows.length),
        confidence: confidenceTier(rows.length)
      };
    }).sort((a, b) => b.avgR - a.avgR);

    const adds = signalBuckets.get('CONTINUATION_ADD') ?? [];
    const vwapRows = signalBuckets.get('VWAP_ACCEPTANCE_CONTINUATION') ?? [];
    const avgRecovered = recoveries.length
      ? recoveries.reduce((n, r) => n + r.recoveredR, 0) / recoveries.length
      : 0;

    const report: ContinuationParticipationReport = {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: Date.now(),
      sampleCount: n,
      participationSignals,
      suppressionRecoveries: recoveries.sort((a, b) => b.recoveredR - a.recoveredR).slice(0, 20),
      continuationAdds: this.bucketStats(adds),
      vwapAcceptanceContinuations: this.bucketStats(vwapRows),
      participationExpectancy: participationSignals.length
        ? participationSignals.reduce((s, p) => s + p.avgR * p.count, 0) / Math.max(1, participationSignals.reduce((s, p) => s + p.count, 0))
        : 0,
      governanceRelaxationCases: (discoveryReport?.governanceSuppressedPatterns ?? []).slice(0, 8).map(g => ({
        strategyName: g.strategyName,
        suppressedPct: g.suppressedPct,
        avgMissedR: g.avgMissedR,
        sampleCount: g.sampleCount
      })),
      expansionCaptureImprovement: {
        baselineMissedR: avgRecovered,
        recoveredR: avgRecovered,
        improvementPct: recoveries.length ? Math.round(recoveries.length / Math.max(1, n) * 1000) / 10 : 0
      },
      summaryInsights: this.insights(n, recoveries.length, participationSignals.length)
    };

    this.reportSubject.next(report);
    return report;
  }

  applyToLiveDecision(
    snapshot: LiveExecutionDecisionSnapshot,
    input: ContinuationParticipationInput
  ): LiveExecutionDecisionSnapshot {
    const overlay = this.buildOverlay(snapshot.decision, input);
    if (!overlay.active || !overlay.signalType) {
      return { ...snapshot, continuationParticipation: overlay };
    }
    return {
      ...snapshot,
      decision: overlay.promotedDecision,
      decisionLabel: overlay.signalType.replace(/_/g, ' '),
      keyReason: overlay.promotionReason,
      compactLine: `${overlay.signalType.replace(/_/g, ' ')} · score ${overlay.participationScore}`,
      detailLine: overlay.matchedArchetype
        ? `Archetype ${overlay.matchedArchetype} · similarity ${Math.round(overlay.archetypeSimilarity * 100)}%`
        : 'Continuation participation overlay',
      continuationParticipation: overlay
    };
  }

  evaluateForReplay(signal: TradingSignal, originalDecision: LiveExecutionDecision): ContinuationParticipationOverlay | null {
    const n = this.store.query({ symbol: (signal.symbol ?? 'UNK').toUpperCase() }).length;
    const input = inputFromSignal(signal, n);
    const overlay = this.buildOverlay(originalDecision, input);
    return overlay.active ? overlay : null;
  }

  buildOverlay(original: LiveExecutionDecision, input: ContinuationParticipationInput): ContinuationParticipationOverlay {
    const discoveryReport = this.discovery.snapshot();
    const exhaustion = this.risk.isExhaustion(input);
    const { score: rawScore, matchedArchetype, similarity } = this.confidence.score(input, discoveryReport);
    const robustMult = this.robustness.confidenceMultiplier(matchedArchetype);
    const score = Math.round(rawScore * robustMult);
    const none: ContinuationParticipationOverlay = {
      active: false,
      signalType: null,
      participationScore: score,
      originalDecision: original,
      promotedDecision: original,
      promotionReason: '',
      matchedArchetype,
      archetypeSimilarity: similarity,
      suppressionRegretR: this.governance.regretR(discoveryReport, matchedArchetype),
      statsBacked: !!matchedArchetype,
      expectedR: null,
      exhaustionBlocked: exhaustion,
      advisoryOnly: true
    };

    if (exhaustion) return { ...none, promotionReason: 'Exhaustion guard — parabolic extension blocked' };
    if (score < 50 && !isWaitOrSuppress(original)) return none;

    const signalType = this.resolveSignalType(input);
    const relax = this.governance.shouldRelax(original, score, discoveryReport, matchedArchetype);
    if (!relax && score < 62) return none;

    const promoted = this.governance.promotedDecision(original, score);
    if (promoted === original && !isWaitOrSuppress(original)) return none;

    const strat = discoveryReport?.discoveredStrategies.find(s => s.name === matchedArchetype);
    const reason = relax
      ? `Governance suppression historically misses +${strat?.avgR ?? this.governance.regretR(discoveryReport, matchedArchetype) ?? 2}R avg · participation justified${robustMult < 1 ? ` · robustness adj ${Math.round(robustMult * 100)}%` : ''}`
      : `Continuation participation statistically favorable · score ${score}`;

    return {
      active: true,
      signalType,
      participationScore: score,
      originalDecision: original,
      promotedDecision: promoted,
      promotionReason: reason,
      matchedArchetype,
      archetypeSimilarity: similarity,
      suppressionRegretR: this.governance.regretR(discoveryReport, matchedArchetype),
      statsBacked: !!strat?.promotable,
      expectedR: strat?.avgR ?? (score >= 70 ? 2.4 : 1.5),
      exhaustionBlocked: false,
      advisoryOnly: true
    };
  }

  private resolveSignalType(input: ContinuationParticipationInput): ContinuationParticipationSignalType {
    const scores: [ContinuationParticipationSignalType, number][] = [
      ['CONTINUATION_ADD', this.add.score(input)],
      ['EARLY_EXPANSION_ENTRY', this.early.score(input)],
      ['VWAP_ACCEPTANCE_CONTINUATION', this.vwap.score(input)],
      ['SHALLOW_PULLBACK_CONTINUATION', this.pull.score(input)],
      ['HIGH_RVOL_CONTINUATION', (input.rvol ?? 0) >= 4 ? this.expansion.score(input) : 0],
      ['PERSISTENCE_ENTRY', (input.trendAlignment ?? 0) >= 60 ? this.expansion.score(input) : 0]
    ];
    scores.sort((a, b) => b[1] - a[1]);
    return scores[0][1] >= 45 ? scores[0][0] : 'CONTINUATION_ADD';
  }

  private bucketStats(rows: import('../../../models/signal-intelligence.model').SignalSnapshot[]) {
    if (!rows.length) return { count: 0, avgR: 0, winRate: 0 };
    const wins = rows.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5);
    return {
      count: rows.length,
      avgR: Math.round(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length * 100) / 100,
      winRate: pct(wins.length, rows.length)
    };
  }

  private insights(n: number, recoveries: number, signals: number): string[] {
    const lines: string[] = [];
    if (n < 10) lines.push('Insufficient sample — hydrate before trusting continuation participation.');
    lines.push(`${signals} participation signal types active in historical replay.`);
    lines.push(`${recoveries} WAIT/AVOID suppressions would have recovered +1.5R+ via participation overlay.`);
    lines.push('Advisory only — no auto-trading or threshold mutation.');
    return lines;
  }
}
