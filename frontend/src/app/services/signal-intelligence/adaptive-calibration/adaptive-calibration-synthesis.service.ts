import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { confidenceFromCount, evaluatedSignals } from '../signal-intelligence.math';
import { ConvictionCalibrationEngine } from './conviction-calibration-engine';
import { WaitCalibrationEngine } from './wait-calibration-engine';
import { SuppressionCalibrationEngine } from './suppression-calibration-engine';
import { NarrativeConfidenceEngine } from './narrative-confidence-engine';
import { ExpansionCaptureEfficiencyEngine } from './expansion-capture-efficiency.engine';
import { AdaptiveGovernanceBalanceEngine } from './adaptive-governance-balance.engine';
import { CalibrationRegretEngine } from './calibration-regret-engine';
import {
  AdaptiveCalibrationObservation,
  AdaptiveCalibrationReport,
  LiveAdaptiveCalibrationInput,
  LiveAdaptiveCalibrationIntel,
  PlaybookCalibrationProfile
} from './adaptive-calibration.models';
import { MIN_AUTHORITATIVE, MIN_LOW_CONFIDENCE } from './adaptive-calibration.util';

/** Phase 148 orchestrator — self-aware calibration intelligence (advisory only). */
@Injectable({ providedIn: 'root' })
export class AdaptiveCalibrationSynthesisService {
  private readonly convictionEngine = new ConvictionCalibrationEngine();
  private readonly waitEngine = new WaitCalibrationEngine();
  private readonly suppressionEngine = new SuppressionCalibrationEngine();
  private readonly narrativeEngine = new NarrativeConfidenceEngine();
  private readonly expansionEngine = new ExpansionCaptureEfficiencyEngine();
  private readonly governanceEngine = new AdaptiveGovernanceBalanceEngine();
  private readonly regretEngine = new CalibrationRegretEngine();

  private readonly reportSubject = new BehaviorSubject<AdaptiveCalibrationReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(private store: SignalIntelligenceStore) {
    this.store.revision$.subscribe(() => this.refresh());
  }

  snapshot(): AdaptiveCalibrationReport | null {
    return this.reportSubject.value;
  }

  refresh(filter: SignalIntelligenceFilter = {}): AdaptiveCalibrationReport {
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs });
    return this.buildReport(signals, lookbackDays);
  }

  liveIntel(input: LiveAdaptiveCalibrationInput): LiveAdaptiveCalibrationIntel {
    const report = this.snapshot();
    const n = input.sampleCount ?? 0;
    const authoritative = n >= MIN_AUTHORITATIVE;

    const highRow = report?.conviction.rows.find(r => r.band === 'HIGH');
    const modRow = report?.conviction.rows.find(r => r.band === 'MODERATE');
    const calibratedConvictionBias = highRow?.reliability !== 'INSUFFICIENT'
      ? highRow!.reliability
      : modRow?.reliability !== 'INSUFFICIENT' ? modRow!.reliability : null;

    const waitPullback = report?.wait.rows.find(r => r.waitType === 'WAIT_FOR_PULLBACK');
    const waitJustified = waitPullback
      ? waitPullback.fakeoutReductionPct > 5 && waitPullback.missedExpansionPct < 55
      : false;

    const governanceTooConservative = report?.governance.balance === 'TOO_CONSERVATIVE';
    const narrativeStable = input.narrativeTrajectory === 'NARRATIVE_STABLE'
      || input.narrativeTrajectory === 'NARRATIVE_IMPROVING'
      || (input.narrativeQuality ?? 50) >= 55;

    const regretScore = report?.regret.regretScore ?? 50;
    const lowRegretZone = report?.regret.lowRegretZone ?? false;

    const secondLeg = report?.expansion.rows.find(r => r.style === 'SECOND_LEG_ACCEPTANCE');
    const expansionCaptureHint = secondLeg && secondLeg.sampleCount >= MIN_LOW_CONFIDENCE
      ? `Second-leg captures ~${secondLeg.capturePct}% with ${secondLeg.continuationSurvival}% continuation survival`
      : null;

    const guidanceLine = this.pickGuidanceLine(report, input, n);
    const detailLines = this.buildDetailLines(report, input, n);

    return {
      guidanceLine,
      compactLine: guidanceLine,
      calibratedConvictionBias,
      waitJustified,
      governanceTooConservative: governanceTooConservative ?? false,
      narrativeStable,
      regretScore,
      lowRegretZone,
      expansionCaptureHint,
      detailLines,
      authoritative,
      advisoryOnly: true
    };
  }

  playbookProfiles(): PlaybookCalibrationProfile[] {
    return this.snapshot()?.playbookProfiles ?? [];
  }

  private buildReport(
    signals: ReturnType<SignalIntelligenceStore['query']>,
    lookbackDays: number
  ): AdaptiveCalibrationReport {
    const evaluated = evaluatedSignals(signals);
    const conviction = this.convictionEngine.analyze(signals);
    const wait = this.waitEngine.analyze(signals);
    const suppression = this.suppressionEngine.analyze(signals);
    const narrative = this.narrativeEngine.analyze(signals);
    const expansion = this.expansionEngine.analyze(signals);
    const governance = this.governanceEngine.analyze(signals);
    const regret = this.regretEngine.analyze(signals);
    const playbookProfiles = this.buildPlaybookProfiles(signals.length, narrative, wait, suppression);

    const partial = {
      lookbackDays,
      totalEvaluated: evaluated.length,
      conviction,
      wait,
      suppression,
      narrative,
      expansion,
      governance,
      regret,
      playbookProfiles,
      observations: [] as AdaptiveCalibrationObservation[],
      synthesis: [] as { id: string; headline: string; detail: string }[],
      advisoryOnly: true as const
    };

    const observations = this.buildObservations(partial, evaluated.length);
    const synthesis = observations.slice(0, 6).map(o => ({
      id: o.id,
      headline: o.headline,
      detail: o.detail
    }));

    const report: AdaptiveCalibrationReport = { ...partial, observations, synthesis };
    this.reportSubject.next(report);
    return report;
  }

  private buildObservations(
    report: Omit<AdaptiveCalibrationReport, 'observations' | 'synthesis'>,
    n: number
  ): AdaptiveCalibrationObservation[] {
    const out: AdaptiveCalibrationObservation[] = [];
    const conf = confidenceFromCount(n);

    const overstated = report.conviction.rows.find(r => r.reliability === 'OVERSTATED');
    if (overstated) {
      out.push({
        id: 'conv-over',
        headline: `Conviction is overstated in ${overstated.band.toLowerCase()} environments.`,
        detail: `Expected ${overstated.expectedR >= 0 ? '+' : ''}${overstated.expectedR.toFixed(1)}R · actual ${overstated.actualR >= 0 ? '+' : ''}${overstated.actualR.toFixed(1)}R · n=${overstated.sampleCount}`,
        confidence: overstated.confidence
      });
    }

    const understated = report.conviction.rows.find(r => r.reliability === 'UNDERSTATED');
    if (understated) {
      out.push({
        id: 'conv-under',
        headline: `${understated.band} conviction is understated — continuation under-trusted.`,
        detail: `Expected ${understated.expectedR.toFixed(1)}R · actual ${understated.actualR.toFixed(1)}R`,
        confidence: understated.confidence
      });
    }

    const waitPullback = report.wait.rows.find(r => r.waitType === 'WAIT_FOR_PULLBACK');
    if (waitPullback && waitPullback.sampleCount >= MIN_LOW_CONFIDENCE) {
      out.push({
        id: 'wait-tradeoff',
        headline: 'Waiting improves fakeout avoidance but excessively sacrifices continuation expansion.',
        detail: `Pullback wait: fakeout −${waitPullback.fakeoutReductionPct}% · missed expansion ${waitPullback.missedExpansionPct}%`,
        confidence: waitPullback.confidence
      });
    }

    const secondLeg = report.expansion.rows.find(r => r.style === 'SECOND_LEG_ACCEPTANCE');
    if (secondLeg && secondLeg.sampleCount >= MIN_LOW_CONFIDENCE) {
      out.push({
        id: 'second-leg',
        headline: 'Second-leg narratives justify more aggressive execution.',
        detail: `Captures ${secondLeg.capturePct}% of move · ${secondLeg.continuationSurvival}% continuation survival`,
        confidence: secondLeg.confidence
      });
    }

    if (report.governance.balance === 'TOO_CONSERVATIVE' && n >= MIN_LOW_CONFIDENCE) {
      out.push({
        id: 'gov-conservative',
        headline: 'Current governance suppresses too many continuation winners.',
        detail: `${report.governance.falseAvoidRate}% false avoids · ${report.governance.missedExpansionRate}% missed expansion from waiting`,
        confidence: conf
      });
    }

    const chaseUnsafe = report.suppression.rows.find(r => r.zone === 'CHASE' && r.safety === 'UNSAFE');
    if (chaseUnsafe) {
      out.push({
        id: 'chase-unsafe',
        headline: 'CHASE suppression is unsafe — filtering valid continuation winners.',
        detail: `${chaseUnsafe.falseAvoidRate}% false avoid rate · n=${chaseUnsafe.sampleCount}`,
        confidence: chaseUnsafe.confidence
      });
    }

    const trapSafe = report.suppression.rows.find(r => r.zone === 'TRAP_RISK' && r.safety === 'SAFE');
    if (trapSafe) {
      out.push({
        id: 'trap-safe',
        headline: 'TRAP_RISK suppression is well-calibrated — safe to preserve.',
        detail: `${trapSafe.safeSuppressionRate}% safe suppression rate`,
        confidence: trapSafe.confidence
      });
    }

    const unstable = report.narrative.unstableNarrativeRate;
    if (unstable > 25 && n >= MIN_LOW_CONFIDENCE) {
      out.push({
        id: 'narrative-unstable',
        headline: 'Conviction should be calibrated lower in unstable narrative environments.',
        detail: `${unstable}% of trades in failing/exhausted narratives`,
        confidence: conf
      });
    }

    return out;
  }

  private buildPlaybookProfiles(
    n: number,
    narrative: AdaptiveCalibrationReport['narrative'],
    wait: AdaptiveCalibrationReport['wait'],
    suppression: AdaptiveCalibrationReport['suppression']
  ): PlaybookCalibrationProfile[] {
    const conf = confidenceFromCount(n);
    const secondLegAggressive = wait.rows.find(r => r.waitType === 'WAIT_FOR_SECOND_LEG');
    const openingDowngrade = narrative.rows.find(r => r.trajectory === 'NARRATIVE_EXHAUSTED');

    return [
      {
        playbookKey: 'FAILED_BREAKOUT_RECLAIM',
        label: 'Failed Breakout Reclaim',
        aggressionAllowed: true,
        convictionAdjustment: 'NEUTRAL',
        waitBias: 'AGGRESSIVE',
        note: 'Aggression allowed after reclaim hold — historical continuation under-trusted.',
        confidence: conf
      },
      {
        playbookKey: 'OPENING_EXTENSION',
        label: 'Opening Extension',
        aggressionAllowed: false,
        convictionAdjustment: 'DOWNGRADE',
        waitBias: 'PATIENT',
        note: openingDowngrade
          ? 'Conviction downgrade required — extension narratives exhaust quickly.'
          : 'Require narrative stability before full aggression.',
        confidence: conf
      },
      {
        playbookKey: 'SECOND_LEG_CONTINUATION',
        label: 'Second Leg Continuation',
        aggressionAllowed: true,
        convictionAdjustment: 'UPGRADE',
        waitBias: secondLegAggressive?.aggressiveness === 'TOO_PATIENT' ? 'AGGRESSIVE' : 'BALANCED',
        note: 'Second-leg acceptance supports controlled aggression after hold confirmation.',
        confidence: secondLegAggressive?.confidence ?? conf
      },
      {
        playbookKey: 'VWAP_RECLAIM',
        label: 'VWAP Reclaim',
        aggressionAllowed: suppression.rows.find(r => r.zone === 'TRAP_RISK')?.safety === 'SAFE',
        convictionAdjustment: 'NEUTRAL',
        waitBias: 'BALANCED',
        note: 'Balance trap filters with reclaim hold patience.',
        confidence: conf
      }
    ];
  }

  private pickGuidanceLine(
    report: AdaptiveCalibrationReport | null | undefined,
    input: LiveAdaptiveCalibrationInput,
    n: number
  ): string | null {
    if (n < MIN_AUTHORITATIVE || !report) return null;

    if (!input.narrativeTrajectory || input.narrativeTrajectory === 'NARRATIVE_FAILING') {
      return 'Conviction calibrated LOWER due to unstable narrative.';
    }

    const understated = report.conviction.rows.find(r => r.reliability === 'UNDERSTATED');
    if (understated) {
      return 'Continuation historically under-trusted here.';
    }

    if (report.governance.balance === 'TOO_CONSERVATIVE') {
      return 'Governance too conservative in this context.';
    }

    const secondLeg = report.expansion.rows.find(r => r.style === 'SECOND_LEG_ACCEPTANCE');
    if (secondLeg && secondLeg.capturePct >= 65 && n >= MIN_LOW_CONFIDENCE) {
      return 'Second-leg continuation supports controlled aggression.';
    }

    const overstated = report.conviction.rows.find(r => r.reliability === 'OVERSTATED');
    if (overstated) {
      return `${overstated.band} conviction calibrated lower — historically overstated.`;
    }

    return report.observations[0]?.headline ?? null;
  }

  private buildDetailLines(
    report: AdaptiveCalibrationReport | null | undefined,
    input: LiveAdaptiveCalibrationInput,
    n: number
  ): string[] {
    if (!report || n < MIN_LOW_CONFIDENCE) {
      return ['Insufficient history for calibration overlay (n < 25).'];
    }

    const lines: string[] = [];
    if (report.regret.regretScore >= 35) {
      lines.push(`Calibration regret ${report.regret.regretScore}/100 — review wait vs aggression balance.`);
    }
    if (input.marketRegime) {
      lines.push(`Regime ${input.marketRegime.replace(/_/g, ' ')} · governance ${report.governance.balance.replace(/_/g, ' ').toLowerCase()}`);
    }
    const waitBalanced = report.wait.rows.find(r => r.aggressiveness === 'BALANCED');
    if (waitBalanced) {
      lines.push(`Optimal wait: ${waitBalanced.label}`);
    }
    return lines.slice(0, 3);
  }
}
