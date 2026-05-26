import { Injectable } from '@angular/core';
import { ReplayHistory, ReplaySignalEvent } from '../../models/replay.model';
import { ReplayDecisionTimelineRow } from './replay-decision-visualization.models';
import { ReplayEntryDecisionEngine } from './replay-entry-decision.engine';
import { ReplayExitVisualizationEngine } from './replay-exit-visualization.engine';
import { ReplayNarrativeOverlayEngine } from './replay-narrative-overlay.engine';
import { signalToTradingSignal } from './replay-decision-visualization.models';

@Injectable({ providedIn: 'root' })
export class ReplayDecisionTimelineEngine {
  constructor(
    private entryDecision: ReplayEntryDecisionEngine,
    private exitViz: ReplayExitVisualizationEngine,
    private narrative: ReplayNarrativeOverlayEngine
  ) {}

  buildRows(history: ReplayHistory, cursorIndex: number, reviewMode: boolean): ReplayDecisionTimelineRow[] {
    const cutoff = reviewMode
      ? Number.MAX_SAFE_INTEGER
      : new Date(history.sessionCandles[cursorIndex]?.time ?? 0).getTime();

    return history.timeline
      .filter(e => new Date(e.timestamp).getTime() <= cutoff)
      .map(e => this.toRow(e, history))
      .slice(-24);
  }

  private toRow(event: ReplaySignalEvent, history: ReplayHistory): ReplayDecisionTimelineRow {
    const signal = signalToTradingSignal(event, history.symbol);
    const exit = this.exitViz.buildOverlay(signal);
    const entry = this.entryDecision.buildOverlay(signal);
    const barIndex = this.barForEvent(event, history) ?? 0;
    const decisionLabel = exit?.compactLabel.split(' · ')[0]
      ?? (entry.promoted ? `${entry.fullLabel} ↑ promoted` : entry.fullLabel);
    const conviction = entry.convictionPct;
    return {
      time: event.timestamp,
      timeLabel: this.formatTime(event.timestamp),
      decisionLabel,
      convictionPct: conviction,
      narrativeLine: this.narrative.narrativeForEvent(event),
      detailLine: entry.promoted
        ? `${entry.promotionReason ?? entry.rationale} · was ${entry.originalDecision?.replace(/_/g, ' ') ?? 'WAIT'}`
        : (exit?.reason ?? entry.rationale),
      expectedR: exit?.rrLabel ?? entry.expectedR ?? (entry.type === 'FULL_EXECUTION' || entry.promoted ? '+2.1R' : null),
      signalType: event.signalType,
      barIndex
    };
  }

  private barForEvent(event: ReplaySignalEvent, history: ReplayHistory): number | null {
    const targetMs = new Date(event.timestamp).getTime();
    let best = -1;
    let bestDelta = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < history.sessionCandles.length; i++) {
      const ms = new Date(history.sessionCandles[i].time).getTime();
      const delta = Math.abs(ms - targetMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = i;
      }
    }
    return best >= 0 ? best : null;
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
