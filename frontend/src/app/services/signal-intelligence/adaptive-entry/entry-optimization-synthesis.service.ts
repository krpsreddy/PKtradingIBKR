import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { evaluatedSignals } from '../signal-intelligence.math';
import { AdaptiveEntryWindowEngine } from './adaptive-entry-window.engine';
import { AggressiveVsPatientEntryEngine } from './aggressive-vs-patient-entry.engine';
import { EntryLocationQualityEngine } from './entry-location-quality.engine';
import { NarrativeEntryEfficiencyEngine } from './narrative-entry-efficiency.engine';
import { MissedExpansionAnalysisEngine } from './missed-expansion-analysis.engine';
import { InstitutionalTimingPatternsEngine } from './institutional-timing-patterns.engine';
import { NarrativePlaybookEngine } from '../market-state/narrative-playbook.engine';
import {
  AdaptiveEntryReport,
  LiveAdaptiveEntryInput,
  LiveAdaptiveEntryIntel,
  PlaybookEntryZone
} from './adaptive-entry.models';
import {
  classifyLiveEntryWindow,
  ENTRY_LOCATION_LABELS,
  ENTRY_WINDOW_LABELS,
  entryStyle,
  isIdealLocation,
  isPoorLocation,
  locationGuidance,
  MIN_AUTHORITATIVE,
  MIN_LOW_CONFIDENCE
} from './adaptive-entry.util';

/** Phase 146 orchestrator — adaptive entry optimization (advisory only). */
@Injectable({ providedIn: 'root' })
export class EntryOptimizationSynthesisService {
  private readonly windowEngine = new AdaptiveEntryWindowEngine();
  private readonly styleEngine = new AggressiveVsPatientEntryEngine();
  private readonly locationEngine = new EntryLocationQualityEngine();
  private readonly efficiencyEngine = new NarrativeEntryEfficiencyEngine();
  private readonly missedEngine = new MissedExpansionAnalysisEngine();
  private readonly institutionalEngine = new InstitutionalTimingPatternsEngine();
  private readonly narrativePlaybooks = new NarrativePlaybookEngine();

  private readonly reportSubject = new BehaviorSubject<AdaptiveEntryReport | null>(null);
  readonly report$ = this.reportSubject.asObservable();

  constructor(private store: SignalIntelligenceStore) {
    this.store.revision$.subscribe(() => this.refresh());
  }

  snapshot(): AdaptiveEntryReport | null {
    return this.reportSubject.value;
  }

  refresh(filter: SignalIntelligenceFilter = {}): AdaptiveEntryReport {
    const lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS;
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ ...filter, fromTs });
    return this.buildReport(signals, lookbackDays);
  }

  liveIntel(input: LiveAdaptiveEntryInput): LiveAdaptiveEntryIntel {
    const report = this.snapshot();
    const location = this.locationEngine.classifyLive(input);
    const window = classifyLiveEntryWindow(input);
    const n = input.sampleCount ?? 0;

    const bestWindow = report?.entryWindows.find(w => w.sampleCount >= MIN_AUTHORITATIVE)
      ?? report?.entryWindows[0];
    const optimalWindowHint = bestWindow && n >= MIN_AUTHORITATIVE
      ? `Historical best: ${bestWindow.label} (${bestWindow.expectancyR >= 0 ? '+' : ''}${bestWindow.expectancyR.toFixed(2)}R)`
      : null;

    const styleRecommendation = report?.aggressiveVsPatient.length
      ? (report.aggressiveVsPatient.find(s => s.style === 'PATIENT')!.expectancyR
        > report.aggressiveVsPatient.find(s => s.style === 'AGGRESSIVE')!.expectancyR
        ? 'PATIENT' as const : 'AGGRESSIVE' as const)
      : null;

    return {
      entryLocation: location,
      locationLabel: ENTRY_LOCATION_LABELS[location],
      entryWindow: window,
      windowLabel: ENTRY_WINDOW_LABELS[window],
      guidanceLine: locationGuidance(location),
      compactLine: locationGuidance(location),
      efficiencyPct: null,
      optimalWindowHint,
      styleRecommendation,
      detailLines: [
        `${ENTRY_WINDOW_LABELS[window]} · ${ENTRY_LOCATION_LABELS[location]}`,
        optimalWindowHint ?? 'Insufficient history for optimal window'
      ].filter(Boolean),
      authoritative: n >= MIN_AUTHORITATIVE,
      advisoryOnly: true
    };
  }

  efficiencyForSignal(signal: ReturnType<SignalIntelligenceStore['query']>[0]): number {
    return this.efficiencyEngine.captureForSignal(signal);
  }

  private buildReport(signals: ReturnType<SignalIntelligenceStore['query']>, lookbackDays: number): AdaptiveEntryReport {
    const evaluated = evaluatedSignals(signals);
    const entryWindows = this.windowEngine.analyze(signals);
    const locations = this.locationEngine.analyze(signals);
    const aggressiveVsPatient = this.styleEngine.analyze(signals);
    const missedExpansion = this.missedEngine.analyze(signals);
    const institutionalTiming = this.institutionalEngine.analyze(signals);
    const playbookEntryZones = this.buildPlaybookZones(signals, entryWindows, locations);

    const report: AdaptiveEntryReport = {
      lookbackDays,
      totalEvaluated: evaluated.length,
      bestEntryLocations: locations.filter(l => l.verdict === 'BEST' || l.expectancyR > 0.3).slice(0, 8),
      dangerousEntryLocations: locations.filter(l => l.verdict === 'DANGEROUS' || l.expectancyR < -0.2).slice(0, 6),
      entryWindows,
      aggressiveVsPatient,
      missedExpansion,
      institutionalTiming,
      playbookEntryZones,
      synthesis: this.synthesize(entryWindows, locations, aggressiveVsPatient, missedExpansion, evaluated.length),
      advisoryOnly: true
    };

    this.reportSubject.next(report);
    return report;
  }

  private buildPlaybookZones(
    signals: ReturnType<SignalIntelligenceStore['query']>,
    windows: AdaptiveEntryReport['entryWindows'],
    locations: ReturnType<EntryLocationQualityEngine['analyze']>
  ): PlaybookEntryZone[] {
    const playbooks = this.narrativePlaybooks.discover(signals);
    const bestWindows = windows.filter(w => w.expectancyR > 0.3 && w.sampleCount >= 3).slice(0, 3).map(w => w.label);
    const avoidLocations = locations.filter(l => l.verdict === 'DANGEROUS' || l.expectancyR < -0.2).map(l => l.label);

    return playbooks.slice(0, 8).map(p => ({
      playbookId: p.id,
      playbookLabel: p.label,
      bestEntries: bestWindows.length ? bestWindows : ['Reclaim hold', 'Second leg acceptance'],
      avoidEntries: avoidLocations.length ? avoidLocations : ['First extension chase', 'Third extension chase']
    }));
  }

  private synthesize(
    windows: AdaptiveEntryReport['entryWindows'],
    locations: AdaptiveEntryReport['bestEntryLocations'],
    styles: AdaptiveEntryReport['aggressiveVsPatient'],
    missed: AdaptiveEntryReport['missedExpansion'],
    n: number
  ): AdaptiveEntryReport['synthesis'] {
    const lines: AdaptiveEntryReport['synthesis'] = [];
    if (n < MIN_AUTHORITATIVE) return lines;

    const secondLeg = windows.find(w => w.window === 'SECOND_LEG_TRIGGER');
    if (secondLeg && secondLeg.sampleCount >= MIN_AUTHORITATIVE) {
      lines.push({
        id: 'second-leg',
        headline: 'Second-leg entries maximize continuation survival.',
        detail: `${secondLeg.expectancyR >= 0 ? '+' : ''}${secondLeg.expectancyR.toFixed(2)}R · cont ${secondLeg.continuationRate}% · n=${secondLeg.sampleCount}`
      });
    }

    const instant = windows.find(w => w.window === 'INSTANT_BREAKOUT');
    if (instant && instant.sampleCount >= MIN_AUTHORITATIVE) {
      lines.push({
        id: 'instant-breakout',
        headline: 'Instant breakout entries capture expansion but increase fakeout risk.',
        detail: `Fakeout ${instant.fakeoutRate}% · missed expansion ${instant.missedExpansionPct}%`
      });
    }

    const reclaim = windows.find(w => w.window === 'RECLAIM_HOLD');
    if (reclaim && reclaim.expectancyR > 0.5) {
      lines.push({
        id: 'reclaim-hold',
        headline: 'Reclaim-hold entries produce best risk-adjusted expectancy.',
        detail: `${reclaim.expectancyR.toFixed(2)}R · fakeout ${reclaim.fakeoutRate}% · n=${reclaim.sampleCount}`
      });
    }

    const ideal = locations.find(l => l.location === 'IDEAL_LOCATION' || l.location === 'INSTITUTIONAL_LOCATION');
    if (ideal && ideal.sampleCount >= MIN_LOW_CONFIDENCE) {
      lines.push({
        id: 'ideal-loc',
        headline: `${ideal.label} entries outperform extended locations.`,
        detail: `${ideal.expectancyR.toFixed(2)}R · cont ${ideal.continuationRate}%`
      });
    }

    const pullbackWait = missed.find(m => m.waitStrategy.includes('Pullback'));
    if (pullbackWait) {
      lines.push({
        id: 'missed-pb',
        headline: 'Wait-for-pullback trades safety for expansion capture.',
        detail: `Missed ~${pullbackWait.missedExpansionPct}% expansion · fakeout −${pullbackWait.fakeoutReductionPct}%`
      });
    }

    return lines.slice(0, 6);
  }
}
