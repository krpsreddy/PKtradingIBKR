import { Injectable } from '@angular/core';
import {
  ReplaySessionSummary,
  SessionHealthStatus
} from './replay-decision-visualization.models';
import { ReplaySessionCatalogEntry, formatSessionLabel } from '../replay-workstation/replay-workstation.models';

@Injectable({ providedIn: 'root' })
export class ReplaySessionHealthEngine {
  mergeCatalog(
    summaries: ReplaySessionSummary[],
    fallback: ReplaySessionCatalogEntry[]
  ): ReplaySessionCatalogEntry[] {
    const byDate = new Map(summaries.map(s => [s.sessionDate, s]));
    const dates = new Set([...summaries.map(s => s.sessionDate), ...fallback.map(f => f.sessionDate)]);

    return [...dates]
      .sort((a, b) => a.localeCompare(b))
      .map(date => {
        const summary = byDate.get(date);
        const fb = fallback.find(f => f.sessionDate === date);
        if (summary) return this.fromSummary(summary);
        return fb ?? {
          sessionDate: date,
          signalCount: 0,
          totalBars: 0,
          replayReady: true,
          stale: true,
          bestSetup: null,
          label: formatSessionLabel(date),
          status: 'STALE' as SessionHealthStatus,
          convictionAvg: null,
          healthLabel: 'Stale'
        };
      });
  }

  fromSummary(s: ReplaySessionSummary): ReplaySessionCatalogEntry & {
    status: SessionHealthStatus | string;
    convictionAvg: number | null;
    healthLabel: string;
  } {
    const status = (s.status ?? 'STALE') as SessionHealthStatus;
    const usable = status === 'READY' || status === 'CACHE_ONLY' || status === 'PARTIAL'
      || status === 'NO_SIGNALS' || status === 'STALE';
    return {
      sessionDate: s.sessionDate,
      signalCount: s.signalCount,
      totalBars: 0,
      replayReady: usable,
      stale: s.stale && status !== 'CACHE_ONLY',
      bestSetup: s.bestDecision ?? s.bestNarrative,
      label: formatSessionLabel(s.sessionDate),
      status,
      convictionAvg: s.convictionAvg,
      healthLabel: this.healthLabel(status, s.signalCount, s.convictionAvg)
    };
  }

  dropdownLabel(entry: ReplaySessionCatalogEntry & { status?: string; healthLabel?: string }): string {
    const sig = entry.signalCount > 0 ? `${entry.signalCount} signals` : 'No signals';
    const status = entry.healthLabel ?? entry.status ?? (entry.replayReady ? 'READY' : 'STALE');
    const conv = (entry as { convictionAvg?: number | null }).convictionAvg;
    const convPart = conv != null && conv > 0 ? ` · ${Math.round(conv)}% conv` : '';
    return `${entry.label} · ${sig} · ${status}${convPart}`;
  }

  private healthLabel(status: SessionHealthStatus | string, signals: number, conv: number | null): string {
    if (status === 'READY' && signals > 0) {
      return conv != null && conv >= 75 ? 'High Conviction' : 'Replay Cached';
    }
    if (status === 'CACHE_ONLY') return 'Cache Only';
    if (status === 'PARTIAL') return 'Partial';
    if (status === 'NO_SIGNALS') return 'No Signals';
    if (status === 'REPLAYING') return 'Replaying';
    return 'Stale';
  }
}
