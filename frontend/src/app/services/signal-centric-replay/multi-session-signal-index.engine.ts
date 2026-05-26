import { Injectable } from '@angular/core';
import { ReplaySignalIndexRow, SignalCentricRow } from './signal-centric-replay.models';

/** Dedupe, merge, and sort multi-source signal index rows. */
@Injectable({ providedIn: 'root' })
export class MultiSessionSignalIndexEngine {
  dedupe(rows: ReplaySignalIndexRow[]): ReplaySignalIndexRow[] {
    const map = new Map<string, ReplaySignalIndexRow>();
    for (const row of rows) {
      const existing = map.get(row.signalId);
      if (!existing || this.prefer(row, existing)) {
        map.set(row.signalId, row);
      }
    }
    return [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
  }

  toDisplayRows(rows: ReplaySignalIndexRow[]): SignalCentricRow[] {
    return rows.map(r => this.toDisplayRow(r));
  }

  toDisplayRow(row: ReplaySignalIndexRow): SignalCentricRow {
    const result = this.resultMeta(row);
    return {
      ...row,
      replayIndex: row.replayIndex >= 0 ? row.replayIndex : row.candleIndex,
      timeLabel: this.formatTime(row.timestamp),
      dateLabel: this.formatDate(row.sessionDate),
      signalLabel: this.formatSignalLabel(row),
      qualityLabel: (row.entryQuality ?? '—').replace(/_/g, ' '),
      convictionLabel: row.conviction != null ? `${row.conviction}%` : '—',
      resultLabel: result.label,
      visualTone: this.visualTone(row),
      rankScore: this.rankScore(row)
    };
  }

  private prefer(a: ReplaySignalIndexRow, b: ReplaySignalIndexRow): boolean {
    if (a.resultR != null && b.resultR == null) return true;
    if (a.replayReady && !b.replayReady) return true;
    return false;
  }

  private formatSignalLabel(row: ReplaySignalIndexRow): string {
    const type = (row.setup ?? 'AUTONOMOUS EVENT').replace(/_/g, ' ');
    const action = (row.decision ?? '').replace(/_/g, ' ');
    if (action && action !== 'ENTER' && action !== 'WATCH' && action !== 'ADD' && action !== 'AVOID') {
      return `${action} · ${type}`.trim().toUpperCase();
    }
    if (row.narrative && !row.narrative.toUpperCase().includes(type.toUpperCase())) {
      return row.narrative.replace(/_/g, ' ').toUpperCase();
    }
    return type.toUpperCase();
  }

  private resultMeta(row: ReplaySignalIndexRow): { label: string } {
    const r = row.resultR ?? row.mfe;
    if (r == null) return { label: '—' };
    const sign = r >= 0 ? '+' : '';
    return { label: `${sign}${r.toFixed(1)}R` };
  }

  private visualTone(row: ReplaySignalIndexRow): import('./signal-centric-replay.models').SignalVisualTone {
    const r = row.resultR ?? row.mfe;
    if (row.entryQuality === 'TRAP' || row.decision === 'TRAP_RISK') return 'trap';
    if (r != null && r >= 2) return 'elite';
    if (r != null && r >= 0.5) return 'win';
    if (row.setup === 'VWAP_RECLAIM' || row.narrative?.toUpperCase().includes('RECLAIM')) return 'reclaim';
    if (row.decision === 'WAIT' || row.decision === 'PROBING') return 'wait';
    if (r != null && r < -0.5) return 'trap';
    return 'neutral';
  }

  private rankScore(row: ReplaySignalIndexRow): number {
    const conv = row.conviction ?? 0;
    const r = row.resultR ?? row.mfe ?? 0;
    return conv * 0.4 + r * 15;
  }

  private formatTime(ts: number): string {
    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/New_York'
      }).format(new Date(ts));
    } catch {
      return '—';
    }
  }

  private formatDate(iso: string): string {
    try {
      const d = new Date(iso + 'T12:00:00');
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
    } catch {
      return iso;
    }
  }
}
