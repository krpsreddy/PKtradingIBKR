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
import { decisionForSignal } from '../signal-intelligence/adaptive-calibration/adaptive-calibration.util';
import {
  ActiveRegimeRow,
  LiveRegimeClassification,
  LiveRegimeInput,
  LiveRegimeMetrics,
  LiveRegimeOverlay,
  LiveRegimeReport,
  LiveRegimeType,
  ParticipationOpportunityRow
} from './live-regime.models';
import { PersistenceDetectionEngine } from './persistence-detection.engine';
import { InstitutionalAccelerationEngine } from './institutional-acceleration.engine';
import { PullbackDepthEngine } from './pullback-depth.engine';
import { VelocityPersistenceEngine } from './velocity-persistence.engine';
import { BreadthConfirmationEngine } from './breadth-confirmation.engine';
import { ExpansionProbabilityEngine } from './expansion-probability.engine';
import { ContinuationRegimeEngine } from './continuation-regime.engine';
import { RegimeTransitionEngine } from './regime-transition.engine';
import {
  inputFromSignal,
  inputFromSnapshot,
  inContinuationWindow,
  regimeMarker,
  sessionDateFromTs,
  windowLabel
} from './live-regime.util';
import { IntelligenceOffloadService } from '../intelligence-offload/intelligence-offload.service';
import { LiveRegimeSnapshotDto } from '../intelligence-offload/intelligence-snapshot-api.service';

/** Phase 162 — live regime detection orchestrator (advisory only). */
@Injectable({ providedIn: 'root' })
export class LiveRegimeSynthesisService {
  private readonly persistence = new PersistenceDetectionEngine();
  private readonly acceleration = new InstitutionalAccelerationEngine();
  private readonly pullback = new PullbackDepthEngine();
  private readonly velocity = new VelocityPersistenceEngine();
  private readonly breadth = new BreadthConfirmationEngine();
  private readonly expansion = new ExpansionProbabilityEngine();
  private readonly regime = new ContinuationRegimeEngine();
  private readonly transition = new RegimeTransitionEngine();

  private readonly reportSubject = new BehaviorSubject<LiveRegimeReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(
    private store: SignalIntelligenceStore,
    private offload: IntelligenceOffloadService
  ) {
    this.offload.bindRevisionRefresh(() => this.refresh(), this.store.revision$);
    if (!this.offload.skipFrontendSynthesis()) {
      this.refresh();
    }
  }

  snapshot(): LiveRegimeReport | null {
    return this.reportSubject.value;
  }

  refresh(
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
    filter: SignalIntelligenceFilter = {}
  ): LiveRegimeReport {
    if (this.offload.isEnabled() && filter.symbol) {
      this.offload.fetchLiveRegime(filter.symbol, lookbackDays).subscribe(dto => {
        this.reportSubject.next(this.mapBackendReport(dto, lookbackDays));
      });
    }

    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = evaluatedSignals(this.store.query({ ...filter, fromTs }));
    const activeRows: ActiveRegimeRow[] = [];
    const timeline: LiveRegimeReport['continuationPersistenceTimeline'] = [];
    const opportunities: ParticipationOpportunityRow[] = [];
    const warnings: LiveRegimeReport['regimeTransitionWarnings'] = [];

    for (const s of signals) {
      const input = inputFromSnapshot(s, signals.length);
      const evaluated = this.evaluate(input);
      if (evaluated.metrics.continuationPersistenceScore < 45) continue;

      activeRows.push({
        symbol: s.symbol,
        regimeType: evaluated.regimeType,
        classification: evaluated.classification,
        expansionProbability: evaluated.metrics.expansionProbability,
        continuationPersistenceScore: evaluated.metrics.continuationPersistenceScore,
        sessionTimeMinutes: s.sessionTimeMinutes
      });

      timeline.push({
        symbol: s.symbol,
        sessionDate: sessionDateFromTs(s.timestamp),
        timestamp: s.timestamp,
        regimeType: evaluated.regimeType,
        classification: evaluated.classification,
        continuationPersistenceScore: evaluated.metrics.continuationPersistenceScore
      });

      if (evaluated.participationOpportunity) {
        opportunities.push({
          symbol: s.symbol,
          signalType: s.signalType,
          classification: evaluated.classification,
          expansionProbability: evaluated.metrics.expansionProbability,
          shallowPullbackQuality: evaluated.metrics.shallowPullbackQuality,
          windowLabel: windowLabel(s.sessionTimeMinutes),
          advisoryNote: evaluated.promotionReason
        });
      }

      const warn = this.transition.warning(evaluated.regimeType, evaluated.metrics, input);
      if (warn && evaluated.metrics.exhaustionProbability >= 55) {
        warnings.push({
          symbol: s.symbol,
          fromRegime: evaluated.regimeType,
          toRegime: 'LATE_EXHAUSTION',
          warning: warn,
          exhaustionProbability: evaluated.metrics.exhaustionProbability
        });
      }
    }

    activeRows.sort((a, b) => b.continuationPersistenceScore - a.continuationPersistenceScore);
    opportunities.sort((a, b) => b.expansionProbability - a.expansionProbability);

    const report: LiveRegimeReport = {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: Date.now(),
      sampleCount: signals.length,
      activeContinuationRegimes: activeRows.slice(0, 20),
      institutionalPersistenceLeaderboard: activeRows
        .filter(r => r.regimeType === 'INSTITUTIONAL_PERSISTENCE' || r.regimeType === 'EXPLOSIVE_CONTINUATION')
        .slice(0, 12),
      shallowPullbackContinuations: activeRows
        .filter(r => r.regimeType === 'SHALLOW_PULLBACK_CONTINUATION' || r.regimeType === 'VWAP_ACCEPTANCE_PERSISTENCE')
        .slice(0, 12),
      expansionProbabilityLeaders: [...activeRows].sort((a, b) => b.expansionProbability - a.expansionProbability).slice(0, 12),
      exhaustionProbabilityLeaders: activeRows
        .filter(r => r.classification === 'LATE_STAGE_EXHAUSTION' || r.classification === 'CHOP_UNSTABLE')
        .slice(0, 12),
      regimeTransitionWarnings: warnings.slice(0, 15),
      continuationPersistenceTimeline: timeline.sort((a, b) => b.timestamp - a.timestamp).slice(0, 25),
      participationOpportunities: opportunities.slice(0, 20),
      summaryInsights: this.buildInsights(signals.length, activeRows.length, opportunities.length)
    };

    this.reportSubject.next(report);
    return report;
  }

  applyToLiveDecision(
    snapshot: LiveExecutionDecisionSnapshot,
    input: LiveRegimeInput
  ): LiveExecutionDecisionSnapshot {
    const overlay = this.buildOverlay(snapshot.decision, input);
    if (!overlay.active) {
      return { ...snapshot, liveRegime: overlay };
    }

    const shouldPromote = overlay.participationOpportunity
      && overlay.promotedDecision !== overlay.originalDecision;

    if (!shouldPromote) {
      return { ...snapshot, liveRegime: overlay };
    }

    return {
      ...snapshot,
      decision: overlay.promotedDecision,
      decisionLabel: overlay.classification?.replace(/_/g, ' ') ?? snapshot.decisionLabel,
      keyReason: overlay.promotionReason,
      compactLine: `${regimeMarker(overlay.classification ?? overlay.regimeType!)} · persist ${overlay.metrics.continuationPersistenceScore}`,
      detailLine: overlay.transitionWarning ?? 'Live regime continuation intelligence',
      liveRegime: overlay
    };
  }

  evaluateForReplay(signal: TradingSignal, original: LiveExecutionDecision): LiveRegimeOverlay | null {
    const n = this.store.query({ symbol: (signal.symbol ?? 'UNK').toUpperCase() }).length;
    const overlay = this.buildOverlay(original, inputFromSignal(signal, n));
    return overlay.active ? overlay : null;
  }

  buildOverlay(original: LiveExecutionDecision, input: LiveRegimeInput): LiveRegimeOverlay {
    const evaluated = this.evaluate(input);
    const none: LiveRegimeOverlay = {
      active: false,
      regimeType: evaluated.regimeType,
      classification: evaluated.classification,
      metrics: evaluated.metrics,
      participationOpportunity: false,
      originalDecision: original,
      promotedDecision: original,
      promotionReason: '',
      transitionWarning: evaluated.transitionWarning,
      chartHint: null,
      advisoryOnly: true
    };

    if (evaluated.metrics.exhaustionProbability >= 75 && evaluated.metrics.continuationPersistenceScore < 50) {
      return {
        ...none,
        active: true,
        promotionReason: 'Exhaustion regime — avoid acceleration chase',
        chartHint: regimeMarker(evaluated.classification)
      };
    }

    const favorable = evaluated.participationOpportunity;
    if (!favorable && evaluated.metrics.continuationPersistenceScore < 52) return none;

    const promoted = this.promotedDecision(original, evaluated.metrics, evaluated.classification);
    const reason = this.promotionReason(evaluated.regimeType, evaluated.classification, evaluated.metrics, input);

    return {
      active: true,
      regimeType: evaluated.regimeType,
      classification: evaluated.classification,
      metrics: evaluated.metrics,
      participationOpportunity: favorable,
      originalDecision: original,
      promotedDecision: promoted,
      promotionReason: reason,
      transitionWarning: evaluated.transitionWarning,
      chartHint: regimeMarker(evaluated.classification),
      advisoryOnly: true
    };
  }

  evaluate(input: LiveRegimeInput): {
    regimeType: LiveRegimeType;
    classification: LiveRegimeClassification;
    metrics: LiveRegimeMetrics;
    participationOpportunity: boolean;
    promotionReason: string;
    transitionWarning: string | null;
  } {
    const continuationPersistenceScore = this.persistence.continuationPersistenceScore(input);
    const accelerationIntegrity = this.velocity.accelerationIntegrity(input);
    const shallowPullbackQuality = this.pullback.shallowPullbackQuality(input);
    const institutionalParticipationScore = this.breadth.institutionalParticipationScore(input);
    const trendPersistenceProbability = this.persistence.trendPersistenceProbability(input);
    const expansionProbability = this.expansion.score(
      continuationPersistenceScore,
      accelerationIntegrity,
      shallowPullbackQuality,
      institutionalParticipationScore,
      input
    );
    const exhaustionProbability = this.expansion.exhaustionProbability(
      continuationPersistenceScore,
      accelerationIntegrity,
      input
    );

    const metrics: LiveRegimeMetrics = {
      continuationPersistenceScore,
      accelerationIntegrity,
      shallowPullbackQuality,
      expansionProbability,
      institutionalParticipationScore,
      exhaustionProbability,
      trendPersistenceProbability
    };

    const regimeType = this.regime.detect(input, metrics);
    const classification = this.classify(regimeType, metrics, input);
    const transitionWarning = this.transition.warning(regimeType, metrics, input);
    const participationOpportunity = this.participationOpportunity(metrics, classification, input);

    return {
      regimeType,
      classification,
      metrics,
      participationOpportunity,
      promotionReason: this.promotionReason(regimeType, classification, metrics, input),
      transitionWarning
    };
  }

  private classify(
    regimeType: LiveRegimeType,
    metrics: LiveRegimeMetrics,
    input: LiveRegimeInput
  ): LiveRegimeClassification {
    if (regimeType === 'EXPLOSIVE_CONTINUATION') return 'EXPLOSIVE_CONTINUATION';
    if (regimeType === 'LATE_EXHAUSTION' || regimeType === 'RETAIL_CHASE_EXHAUSTION') {
      return 'LATE_STAGE_EXHAUSTION';
    }
    if (regimeType === 'CHOP_INSTABILITY') return 'CHOP_UNSTABLE';
    if (regimeType === 'EARLY_ACCELERATION' || regimeType === 'TREND_COMPRESSION_RELEASE') {
      return 'REACCELERATION_READY';
    }
    if (regimeType === 'SHALLOW_PULLBACK_CONTINUATION') return 'HEALTHY_PULLBACK';
    if (input.extended && metrics.continuationPersistenceScore >= 58 && metrics.accelerationIntegrity >= 55) {
      return 'EXTENDED_BUT_HEALTHY';
    }
    if (metrics.continuationPersistenceScore >= 55) return 'PERSISTENT_TREND';
    return 'CHOP_UNSTABLE';
  }

  private participationOpportunity(
    metrics: LiveRegimeMetrics,
    classification: LiveRegimeClassification,
    input: LiveRegimeInput
  ): boolean {
    if (classification === 'LATE_STAGE_EXHAUSTION' || classification === 'CHOP_UNSTABLE') return false;
    if (metrics.exhaustionProbability >= 70) return false;
    if (metrics.continuationPersistenceScore < 58) return false;
    if (!this.velocity.rvolSustained(input)) return false;
    if (!inContinuationWindow(input.sessionTimeMinutes) && metrics.expansionProbability < 65) return false;
    return metrics.expansionProbability >= 55
      || (metrics.continuationPersistenceScore >= 65 && metrics.shallowPullbackQuality >= 55);
  }

  private promotedDecision(
    original: LiveExecutionDecision,
    metrics: LiveRegimeMetrics,
    classification: LiveRegimeClassification
  ): LiveExecutionDecision {
    if (classification === 'LATE_STAGE_EXHAUSTION' || classification === 'CHOP_UNSTABLE') return original;
    const isWait = original.includes('WAIT') || original === 'AVOID_CHASE' || original === 'REDUCE_SIZE';
    if (!isWait) return original;
    if (metrics.expansionProbability >= 72 && metrics.continuationPersistenceScore >= 65) {
      return 'FULL_EXECUTION';
    }
    if (metrics.continuationPersistenceScore >= 58 && metrics.expansionProbability >= 58) {
      return 'PROBING_EXECUTION';
    }
    return original;
  }

  private promotionReason(
    regimeType: LiveRegimeType,
    classification: LiveRegimeClassification,
    metrics: LiveRegimeMetrics,
    input: LiveRegimeInput
  ): string {
    if (classification === 'LATE_STAGE_EXHAUSTION') {
      return 'Late-stage exhaustion — legacy wait appropriate';
    }
    if (classification === 'CHOP_UNSTABLE') {
      return 'Chop instability — continuation edge degraded';
    }
    const window = windowLabel(input.sessionTimeMinutes);
    return `${regimeType.replace(/_/g, ' ')} · persist ${metrics.continuationPersistenceScore} · exp ${metrics.expansionProbability}% · ${window}`;
  }

  private buildInsights(n: number, active: number, opportunities: number): string[] {
    const lines: string[] = [];
    if (n < 10) lines.push('Insufficient sample — hydrate history before trusting live regime detection.');
    lines.push(`${active} continuation regime detections in ${n} evaluated signals.`);
    lines.push(`${opportunities} autonomous participation opportunities identified (9:35–11:00 window prioritized).`);
    lines.push('Big winners often skip deep pullbacks — persistence above VWAP with sustained RVOL is primary signal.');
    lines.push('Advisory only — no auto-trading, threshold mutation, or governance removal.');
    return lines;
  }

  private mapBackendReport(dto: LiveRegimeSnapshotDto, lookbackDays: number): LiveRegimeReport {
    return {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: dto.generatedAt,
      sampleCount: dto.sampleCount,
      activeContinuationRegimes: dto.activeContinuationRegimes.map(r => ({
        symbol: r.symbol,
        regimeType: r.regimeType as LiveRegimeType,
        classification: r.classification as LiveRegimeClassification,
        expansionProbability: r.expansionProbability,
        continuationPersistenceScore: r.continuationPersistenceScore,
        sessionTimeMinutes: r.sessionTimeMinutes
      })),
      institutionalPersistenceLeaderboard: dto.activeContinuationRegimes
        .filter(r => r.regimeType === 'INSTITUTIONAL_PERSISTENCE' || r.regimeType === 'EXPLOSIVE_CONTINUATION')
        .slice(0, 12)
        .map(r => ({
          symbol: r.symbol,
          regimeType: r.regimeType as LiveRegimeType,
          classification: r.classification as LiveRegimeClassification,
          expansionProbability: r.expansionProbability,
          continuationPersistenceScore: r.continuationPersistenceScore,
          sessionTimeMinutes: r.sessionTimeMinutes
        })),
      shallowPullbackContinuations: dto.activeContinuationRegimes
        .filter(r => r.regimeType === 'SHALLOW_PULLBACK_CONTINUATION' || r.regimeType === 'VWAP_ACCEPTANCE_PERSISTENCE')
        .slice(0, 12)
        .map(r => ({
          symbol: r.symbol,
          regimeType: r.regimeType as LiveRegimeType,
          classification: r.classification as LiveRegimeClassification,
          expansionProbability: r.expansionProbability,
          continuationPersistenceScore: r.continuationPersistenceScore,
          sessionTimeMinutes: r.sessionTimeMinutes
        })),
      expansionProbabilityLeaders: [...dto.activeContinuationRegimes]
        .sort((a, b) => b.expansionProbability - a.expansionProbability)
        .slice(0, 12)
        .map(r => ({
          symbol: r.symbol,
          regimeType: r.regimeType as LiveRegimeType,
          classification: r.classification as LiveRegimeClassification,
          expansionProbability: r.expansionProbability,
          continuationPersistenceScore: r.continuationPersistenceScore,
          sessionTimeMinutes: r.sessionTimeMinutes
        })),
      exhaustionProbabilityLeaders: [],
      regimeTransitionWarnings: [],
      continuationPersistenceTimeline: [],
      participationOpportunities: dto.participationOpportunities.map(o => ({
        symbol: o.symbol,
        classification: o.classification as LiveRegimeClassification,
        expansionProbability: o.expansionProbability,
        shallowPullbackQuality: o.shallowPullbackQuality,
        windowLabel: o.windowLabel,
        advisoryNote: o.advisoryNote
      })),
      summaryInsights: dto.summaryInsights
    };
  }

  private emptyReport(lookbackDays: number): LiveRegimeReport {
    return {
      advisoryOnly: true,
      lookbackDays,
      generatedAt: Date.now(),
      sampleCount: 0,
      activeContinuationRegimes: [],
      institutionalPersistenceLeaderboard: [],
      shallowPullbackContinuations: [],
      expansionProbabilityLeaders: [],
      exhaustionProbabilityLeaders: [],
      regimeTransitionWarnings: [],
      continuationPersistenceTimeline: [],
      participationOpportunities: [],
      summaryInsights: ['Backend snapshot mode — select symbol to load regime intelligence']
    };
  }
}
