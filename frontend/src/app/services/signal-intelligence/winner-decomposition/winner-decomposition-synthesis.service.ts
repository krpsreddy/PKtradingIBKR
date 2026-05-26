import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { isEvaluatedSignal } from '../signal-intelligence.math';
import { WinnerDecompositionReport } from './winner-decomposition.models';
import { ExpansionWinnerQueryService } from './expansion-winner-query.service';
import { WinnerConditionClusteringEngine } from './winner-condition-clustering.engine';
import { ContinuationPreconditionEngine } from './continuation-precondition.engine';
import { SuppressionFailureAnalysisEngine } from './suppression-failure-analysis.engine';
import { EliteExpansionProfileEngine } from './elite-expansion-profile.engine';
import { EntryRecaptureEngine } from './entry-recapture.engine';

/** Phase 154 — orchestrates winner decomposition analytics (advisory only). */
@Injectable({ providedIn: 'root' })
export class WinnerDecompositionSynthesisService {
  private readonly clusteringEngine = new WinnerConditionClusteringEngine();
  private readonly preconditionEngine = new ContinuationPreconditionEngine();
  private readonly suppressionEngine = new SuppressionFailureAnalysisEngine();
  private readonly eliteEngine = new EliteExpansionProfileEngine();
  private readonly recaptureEngine = new EntryRecaptureEngine();

  private readonly reportSubject = new BehaviorSubject<WinnerDecompositionReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(
    private store: SignalIntelligenceStore,
    private winnerQuery: ExpansionWinnerQueryService
  ) {
    this.store.revision$.subscribe(() => this.refresh());
    this.refresh();
  }

  snapshot(): WinnerDecompositionReport | null {
    return this.reportSubject.value;
  }

  refresh(
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
    filter: SignalIntelligenceFilter = {}
  ): WinnerDecompositionReport {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const allEvaluated = this.store.query({ ...filter, fromTs }).filter(isEvaluatedSignal);
    const winners = this.winnerQuery.queryWinners(filter, lookbackDays);
    const sampleCount = allEvaluated.length;

    const preconditions = this.preconditionEngine.analyze(winners, sampleCount);
    const recapture = this.recaptureEngine.analyze(winners, sampleCount);
    const recommended = [
      ...this.eliteEngine.buildRecommendedProfiles(winners, sampleCount),
      ...recapture
    ].sort((a, b) => b.avgR - a.avgR).slice(0, 10);

    const missedWinners = this.suppressionEngine.analyzeMissedWinners(winners, sampleCount);
    const amdCaseStudies = this.eliteEngine.buildAmdCaseStudies(allEvaluated, sampleCount, this.winnerQuery);

    const report: WinnerDecompositionReport = {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: Date.now(),
      sampleCount,
      largeWinnerCount: winners.length,
      topExpansionNarratives: this.clusteringEngine.clusterNarratives(winners, sampleCount),
      suppressedWinnerPatterns: this.clusteringEngine.clusterSuppressedPatterns(winners, sampleCount),
      eliteEntryConditions: preconditions.eliteConditions,
      governanceFailures: this.suppressionEngine.analyzeGovernanceFailures(winners, sampleCount),
      continuationAcceptanceProfiles: preconditions.acceptanceProfiles,
      recommendedEntryProfiles: recommended,
      falseAvoidPatterns: this.suppressionEngine.analyzeFalseAvoids(winners, sampleCount),
      trendPersistenceAnalytics: this.clusteringEngine.trendPersistence(winners, sampleCount),
      expansionConditionMatrix: preconditions.matrix,
      biggestWinners: winners.slice(0, 12).map(s => this.winnerQuery.toExpansionWinner(s, sampleCount)),
      missedWinners,
      amdCaseStudies,
      summaryInsights: this.buildInsights(winners.length, missedWinners.length, amdCaseStudies, sampleCount)
    };

    this.reportSubject.next(report);
    return report;
  }

  private buildInsights(
    winnerCount: number,
    missedCount: number,
    amd: WinnerDecompositionReport['amdCaseStudies'],
    sampleCount: number
  ): string[] {
    const insights: string[] = [];
    if (sampleCount < 10) {
      insights.push('Insufficient sample (n<10) — run history hydration before trusting decomposition.');
    }
    if (winnerCount === 0) {
      insights.push('No GT_2R+ winners in evaluated history — hydrate and evaluate signals first.');
    } else {
      insights.push(`${winnerCount} large expansion winners analyzed for pre-entry preconditions.`);
    }
    if (missedCount > 0) {
      insights.push(`${missedCount} suppressed expansion winners — governance wait/avoid over-penalized continuation.`);
    }
    for (const cs of amd) {
      if (cs.matched) {
        insights.push(`${cs.label}: matched session ${cs.sessionDate} — ${cs.governanceSuppressionCause}`);
      } else {
        insights.push(`${cs.label}: no exact price-zone match — review nearest AMD expansion sessions.`);
      }
    }
    insights.push('Advisory only — no auto-trading or threshold mutation.');
    return insights;
  }
}
