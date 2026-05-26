import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import { ExecutionModeService } from '../execution-mode.service';
import { AutonomousDiscoverySynthesisService } from '../autonomous-discovery/autonomous-discovery-synthesis.service';
import { RobustnessValidationSynthesisService } from '../robustness-validation/robustness-validation-synthesis.service';
import { LiveExecutionDecision, LiveExecutionDecisionSnapshot } from '../live-decision/live-decision.models';
import { TradingSignal } from '../../../models/signal.model';
import { decisionForSignal } from '../adaptive-calibration/adaptive-calibration.util';
import {
  AutonomousEntryType,
  AutonomousExecutionInput,
  AutonomousExecutionOverlay,
  AutonomousExecutionReport
} from './autonomous-execution.models';
import { AutonomousPatternMatcherEngine } from './autonomous-pattern-matcher.engine';
import { AutonomousEntryRankingEngine } from './autonomous-entry-ranking.engine';
import { SuppressionRegretRecoveryEngine } from './suppression-regret-recovery.engine';
import { ContinuationRiskBalanceEngine } from '../continuation-participation/continuation-risk-balance.engine';
import { ContinuationParticipationInput } from '../continuation-participation/continuation-participation.models';
import {
  inputFromSignal,
  inputFromSnapshot,
  isWaitOrSuppress,
  mfeR
} from './autonomous-execution.util';
import { ClusterFamilyRegistryService } from '../../cluster-family-intelligence/cluster-family-registry.service';
import { ClusterFamilyExplanationEngine } from '../../cluster-family-intelligence/cluster-family-explanation.engine';

/** Phase 160 — autonomous execution framework orchestrator (advisory only). */
@Injectable({ providedIn: 'root' })
export class AutonomousExecutionSynthesisService {
  private readonly matcher = new AutonomousPatternMatcherEngine();
  private readonly ranker = new AutonomousEntryRankingEngine();
  private readonly regret = new SuppressionRegretRecoveryEngine();
  private readonly risk = new ContinuationRiskBalanceEngine();
  private readonly familyExplain = new ClusterFamilyExplanationEngine();

  private readonly reportSubject = new BehaviorSubject<AutonomousExecutionReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(
    private store: SignalIntelligenceStore,
    private discovery: AutonomousDiscoverySynthesisService,
    private executionMode: ExecutionModeService,
    private robustness: RobustnessValidationSynthesisService,
    private clusterFamilies: ClusterFamilyRegistryService
  ) {
    this.store.revision$.subscribe(() => this.refresh());
    this.executionMode.mode$.subscribe(() => this.refresh());
    this.refresh();
  }

  snapshot(): AutonomousExecutionReport | null {
    return this.reportSubject.value;
  }

  refresh(lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS, filter: SignalIntelligenceFilter = {}): AutonomousExecutionReport {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = evaluatedSignals(this.store.query({ ...filter, fromTs }));
    const n = signals.length;
    const discoveryReport = this.discovery.snapshot();

    const buckets = new Map<AutonomousEntryType, typeof signals>();
    let legacyWaitR = 0;
    let autoR = 0;
    let legacyWaitN = 0;
    let autoN = 0;
    let recoveries = 0;

    for (const s of signals) {
      const input = inputFromSnapshot(s, n);
      const base = decisionForSignal(s, n).decision;
      const overlay = this.buildOverlay(base, input);
      if (overlay.active && overlay.entryType) {
        buckets.set(overlay.entryType, [...(buckets.get(overlay.entryType) ?? []), s]);
        autoR += mfeR(s);
        autoN++;
        if (isWaitOrSuppress(base) && mfeR(s) >= 1.5) recoveries++;
      }
      if (isWaitOrSuppress(base)) {
        legacyWaitR += mfeR(s);
        legacyWaitN++;
      }
    }

    const autonomousEntries = [...buckets.entries()].map(([entryType, rows]) => {
      const wins = rows.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5);
      return {
        entryType,
        count: rows.length,
        winRate: pct(wins.length, rows.length),
        avgR: rows.length ? Math.round(rows.reduce((sum, s) => sum + mfeR(s), 0) / rows.length * 100) / 100 : 0
      };
    }).sort((a, b) => b.avgR - a.avgR);

    const legacyAvg = legacyWaitN ? legacyWaitR / legacyWaitN : 0;
    const autoAvg = autoN ? autoR / autoN : 0;

    const report: AutonomousExecutionReport = {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: Date.now(),
      executionMode: this.executionMode.mode(),
      sampleCount: n,
      autonomousEntries,
      suppressionRegretRecoveries: {
        count: recoveries,
        avgRecoveredR: recoveries ? Math.round(autoAvg * 100) / 100 : 0
      },
      expansionCaptureImprovement: {
        autonomousAvgR: Math.round(autoAvg * 100) / 100,
        legacyAvgR: Math.round(legacyAvg * 100) / 100,
        deltaR: Math.round((autoAvg - legacyAvg) * 100) / 100
      },
      legacyComparison: {
        expansionCapturePct: autoN ? Math.round(autoN / n * 1000) / 10 : 0,
        fakeoutIncreasePct: 0,
        missedContinuationReduction: recoveries,
        entryTimingEfficiency: autoAvg > legacyAvg ? Math.round((autoAvg - legacyAvg) * 100) : 0
      },
      topClusterMatches: this.clusterFamilies.aggregatedFamilies().slice(0, 6).map(f => ({
        cluster: f.displayLabel,
        count: f.sampleCount,
        avgR: f.avgR
      })),
      summaryInsights: this.insights(n, recoveries, this.executionMode.mode())
    };

    this.reportSubject.next(report);
    return report;
  }

  applyToLiveDecision(
    snapshot: LiveExecutionDecisionSnapshot,
    input: AutonomousExecutionInput
  ): LiveExecutionDecisionSnapshot {
    if (!this.executionMode.isAutonomousPrimary()) {
      return snapshot;
    }

    const legacySnapshot = this.executionMode.isHybrid()
      ? { decision: snapshot.decision, decisionLabel: snapshot.decisionLabel, compactLine: snapshot.compactLine }
      : undefined;

    const overlay = this.buildOverlay(snapshot.decision, input);
    if (!overlay.active || !overlay.entryType) {
      return {
        ...snapshot,
        autonomousExecution: overlay,
        legacyDecision: legacySnapshot,
        executionFrameworkMode: this.executionMode.mode()
      };
    }

    return {
      ...snapshot,
      decision: overlay.promotedDecision,
      decisionLabel: overlay.clusterFamily?.displayLabel ?? overlay.entryType.replace(/_/g, ' '),
      keyReason: overlay.promotionReason,
      compactLine: overlay.clusterFamily?.traderCompactLine
        ?? `${overlay.entryType.replace(/_/g, ' ')} · score ${overlay.autonomousEntryScore}`,
      detailLine: overlay.clusterFamily
        ? this.familyExplain.formatResearchDetail(overlay.clusterFamily.researchExpandable)
        : 'Autonomous structural participation',
      autonomousExecution: overlay,
      legacyDecision: legacySnapshot,
      executionFrameworkMode: this.executionMode.mode()
    };
  }

  evaluateForReplay(signal: TradingSignal, original: LiveExecutionDecision): AutonomousExecutionOverlay | null {
    if (!this.executionMode.isAutonomousPrimary()) return null;
    const n = this.store.query({ symbol: (signal.symbol ?? 'UNK').toUpperCase() }).length;
    const overlay = this.buildOverlay(original, inputFromSignal(signal, n));
    return overlay.active ? overlay : null;
  }

  buildOverlay(original: LiveExecutionDecision, input: AutonomousExecutionInput): AutonomousExecutionOverlay {
    const discoveryReport = this.discovery.snapshot();
    const exhaustion = this.risk.isExhaustion(input as ContinuationParticipationInput);
    const { cluster, similarity, expectedR } = this.matcher.match(input, discoveryReport);
    const familyOverlay = this.clusterFamilies.buildLiveOverlay(input);
    const regretR = this.regret.recoveryR(discoveryReport, cluster);
    const { entryType, score: rawScore } = this.ranker.rank(input, similarity, regretR);
    const robustMult = this.robustness.confidenceMultiplier(cluster);
    const familyBoost = Math.min(12, familyOverlay?.aggregateConvictionBoost ?? 0);
    const score = Math.min(100, Math.round(rawScore * robustMult) + familyBoost);

    const none: AutonomousExecutionOverlay = {
      active: false,
      entryType: null,
      autonomousEntryScore: score,
      clusterSimilarity: similarity,
      matchedCluster: cluster,
      matchedClusterId: familyOverlay?.primaryClusterId ?? null,
      clusterFamily: familyOverlay,
      originalDecision: original,
      promotedDecision: original,
      promotionReason: '',
      suppressionRegretRecovery: regretR,
      statsBacked: !!cluster,
      expectedR: expectedR,
      exhaustionBlocked: exhaustion,
      advisoryOnly: true
    };

    if (exhaustion) {
      return { ...none, promotionReason: 'Exhaustion guard — no parabolic chase' };
    }

    const recover = this.regret.shouldRecover(original, score, regretR);
    if (!recover && score < 58 && !isWaitOrSuppress(original)) return none;
    if (score < 50) return none;

    const promoted = score >= 72 ? 'FULL_EXECUTION' : score >= 55 ? 'PROBING_EXECUTION' : original;
    if (promoted === original && !isWaitOrSuppress(original)) return none;

    const canonicalLabel = familyOverlay?.displayLabel ?? entryType.replace(/_/g, ' ');
    const reason = recover
      ? `Governance over-suppressing · historical +${regretR ?? expectedR ?? 2}R recovery`
      : familyOverlay
        ? familyOverlay.traderPromotionReason
        : cluster
          ? `${canonicalLabel} · structural match${robustMult < 1 ? ` · robustness ${Math.round(robustMult * 100)}%` : ''}`
          : `Autonomous expansion structure · score ${score}`;

    return {
      active: true,
      entryType,
      autonomousEntryScore: score,
      clusterSimilarity: similarity,
      matchedCluster: familyOverlay?.primaryClusterName ?? cluster,
      matchedClusterId: familyOverlay?.primaryClusterId ?? null,
      clusterFamily: familyOverlay,
      originalDecision: original,
      promotedDecision: promoted,
      promotionReason: reason,
      suppressionRegretRecovery: regretR,
      statsBacked: similarity >= 0.55,
      expectedR: expectedR ?? (score >= 70 ? 2.4 : 1.5),
      exhaustionBlocked: false,
      advisoryOnly: true
    };
  }

  private insights(n: number, recoveries: number, mode: string): string[] {
    return [
      n < 10 ? 'Insufficient sample for authoritative autonomous execution.' : `Mode: ${mode.replace(/_/g, ' ')}.`,
      `${recoveries} suppression regret recoveries identified in replay.`,
      'Primary signals: structure score, VWAP distance, pullback depth, RVOL, session timing.',
      'Advisory only — legacy signals retained in LEGACY_COMPAT mode.'
    ];
  }
}
