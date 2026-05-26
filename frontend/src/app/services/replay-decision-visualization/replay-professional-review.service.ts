import { Injectable } from '@angular/core';
import { ReplayHistory } from '../../models/replay.model';
import { TradingSignal } from '../../models/signal.model';
import { ReplayCacheApiService } from '../signal-intelligence/replay-cache/replay-cache-api.service';
import { ReplayDecisionTimelineEngine } from './replay-decision-timeline.engine';
import { ReplayEntryDecisionEngine } from './replay-entry-decision.engine';
import { ReplayExitVisualizationEngine } from './replay-exit-visualization.engine';
import { ReplayMultiDayContextEngine } from './replay-multi-day-context.engine';
import { ReplayNarrativeOverlayEngine } from './replay-narrative-overlay.engine';
import { ReplaySessionHealthEngine } from './replay-session-health.engine';
import { ReplaySignalOverlayEngine } from './replay-signal-overlay.engine';
import { ReplayTimeAxisLayoutEngine } from './replay-time-axis-layout.engine';
import {
  ReplayCandleDecisionIntel,
  ReplaySessionReviewSummary,
  ReplaySessionSummary,
  ReplayStudyMode,
  signalToTradingSignal
} from './replay-decision-visualization.models';
import { ReplaySessionCatalogEntry } from '../replay-workstation/replay-workstation.models';

@Injectable({ providedIn: 'root' })
export class ReplayProfessionalReviewService {
  constructor(
    private cacheApi: ReplayCacheApiService,
    private sessionHealth: ReplaySessionHealthEngine,
    private multiDay: ReplayMultiDayContextEngine,
    private timeline: ReplayDecisionTimelineEngine,
    private entryDecision: ReplayEntryDecisionEngine,
    private exitViz: ReplayExitVisualizationEngine,
    private narrative: ReplayNarrativeOverlayEngine,
    private signalOverlay: ReplaySignalOverlayEngine,
    private timeAxis: ReplayTimeAxisLayoutEngine
  ) {}

  fetchSessionSummaries(symbol: string, days = 60): Promise<ReplaySessionSummary[]> {
    return this.cacheApi.fetchSessionSummaries(symbol, days).then(rows => rows ?? []);
  }

  enrichCatalog(
    summaries: ReplaySessionSummary[],
    fallback: ReplaySessionCatalogEntry[]
  ): ReplaySessionCatalogEntry[] {
    return this.sessionHealth.mergeCatalog(summaries, fallback);
  }

  sessionDropdownLabel(entry: ReplaySessionCatalogEntry): string {
    return this.sessionHealth.dropdownLabel(entry as ReplaySessionCatalogEntry & { healthLabel?: string });
  }

  buildReviewSummary(history: ReplayHistory, quality: string): ReplaySessionReviewSummary {
    const entries = history.timeline.filter(e => e.signalType.endsWith('_BUY'));
    const exits = history.timeline.filter(e => e.signalType === 'EXIT' || e.lifecycleState === 'EXITED');
    const bestEntry = entries.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const bestExit = exits[exits.length - 1];
    return {
      sessionLabel: history.replayDate,
      sessionType: this.inferSessionType(history),
      bestSetup: history.lifecyclePath[history.lifecyclePath.length - 1] ?? 'Mixed session',
      bestEntryTime: bestEntry ? this.formatTime(bestEntry.timestamp) : null,
      bestExitTime: bestExit ? this.formatTime(bestExit.timestamp) : null,
      narrativeStability: history.lifecyclePath.length >= 3 ? 'Stable continuation' : 'Mixed narrative',
      replayQuality: quality,
      signalCount: history.timeline.length || history.simulatedSignals
    };
  }

  buildCandleIntel(
    signal: TradingSignal | null,
    barIndex: number,
    timeLabel: string
  ): ReplayCandleDecisionIntel | null {
    if (!signal) return null;
    const exit = this.exitViz.buildOverlay(signal);
    const entry = this.entryDecision.buildOverlay(signal);
    return {
      barIndex,
      timeLabel,
      decisionLabel: exit?.compactLabel.split(' · ')[0] ?? entry.fullLabel,
      convictionPct: entry.convictionPct,
      narrative: entry.rationale,
      entryQuality: entry.type === 'FULL_EXECUTION' ? 'Institutional' : 'Conditional',
      fakeoutRisk: entry.type === 'TRAP_RISK' ? 'High' : entry.type === 'FULL_EXECUTION' ? 'Low' : 'Moderate',
      expectedR: entry.type === 'FULL_EXECUTION' ? '+2.1R' : null,
      actualR: exit?.rrLabel ?? null
    };
  }

  get multiDayEngine() { return this.multiDay; }
  get timelineEngine() { return this.timeline; }
  get narrativeEngine() { return this.narrative; }
  get signalOverlayEngine() { return this.signalOverlay; }
  get timeAxisEngine() { return this.timeAxis; }

  toStudyMode(displayMode: string, reviewMode: boolean): ReplayStudyMode {
    if (displayMode === 'TRAINING') return 'TRAINING';
    if (reviewMode || displayMode === 'REVIEW') return 'STUDY';
    return 'PLAYBACK';
  }

  private inferSessionType(history: ReplayHistory): string {
    const path = history.lifecyclePath.join(' ');
    if (path.includes('CONT') || path.includes('MOM')) return 'TREND DAY';
    if (path.includes('FAIL')) return 'TRAP DAY';
    return 'MIXED DAY';
  }

  private formatTime(iso: string): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(iso));
  }
}
