import { Injectable } from '@angular/core';
import { ReplayHistory, ReplaySignalEvent } from '../../models/replay.model';
import { ReplayBreadcrumb } from './replay-ux.models';
import { ReplayDecisionTimelineRow } from '../replay-decision-visualization/replay-decision-visualization.models';

@Injectable({ providedIn: 'root' })
export class ReplayNavigationUxEngine {
  buildBreadcrumb(
    symbol: string,
    history: ReplayHistory | null,
    barIndex: number,
    selectedEvent: ReplaySignalEvent | null,
    decisionRows: ReplayDecisionTimelineRow[]
  ): ReplayBreadcrumb | null {
    if (!history || barIndex < 0) return null;

    const sessionDate = history.replayDate;
    const sessionLabel = this.formatSessionLabel(sessionDate);
    const bar = history.sessionCandles[barIndex];
    const timeLabel = bar ? this.formatTime(bar.time) : '—';

    const row = decisionRows.find(r => r.barIndex === barIndex);
    const ev = selectedEvent ?? this.eventAtBar(history, barIndex);

    return {
      symbol: symbol.toUpperCase(),
      sessionDate,
      sessionLabel,
      timeLabel,
      decisionLabel: row?.decisionLabel ?? ev?.signalType ?? '—',
      narrativeLabel: row?.narrativeLine ?? ev?.setupLabel ?? '—',
      convictionPct: row?.convictionPct ?? ev?.score ?? null
    };
  }

  private eventAtBar(history: ReplayHistory, barIndex: number): ReplaySignalEvent | null {
    const bar = history.sessionCandles[barIndex];
    if (!bar) return null;
    const ms = new Date(bar.time).getTime();
    let best: ReplaySignalEvent | null = null;
    let bestDelta = Number.MAX_SAFE_INTEGER;
    for (const ev of history.timeline) {
      const delta = Math.abs(new Date(ev.timestamp).getTime() - ms);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = ev;
      }
    }
    return bestDelta < 120_000 ? best : null;
  }

  private formatSessionLabel(iso: string): string {
    try {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso + 'T12:00:00'));
    } catch {
      return iso;
    }
  }

  private formatTime(iso: string): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/New_York'
    }).format(new Date(iso));
  }
}
