import { Injectable } from '@angular/core';
import {
  HistoricalSignalRecord,
  SignalExplorerRow
} from './signal-explorer.models';
import { formatAutonomousRegime } from '../../utils/autonomous-terminology.util';

@Injectable({ providedIn: 'root' })
export class SignalExplorerEngine {
  private static readonly timeFmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/New_York'
  });
  private static readonly dateFmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York'
  });

  toRows(records: HistoricalSignalRecord[]): SignalExplorerRow[] {
    return records.map(r => this.toRow(r));
  }

  toRow(record: HistoricalSignalRecord): SignalExplorerRow {
    const result = this.resultMeta(record);
    return {
      ...record,
      timeLabel: this.formatTime(record.timestampMs),
      dateLabel: this.formatDate(record.sessionDate),
      signalLabel: formatAutonomousRegime(record.signalType, record.narrative ?? record.decision),
      action: record.decision ?? 'WATCH',
      velocityLabel: record.velocity != null && record.velocity > 0 ? `+${record.velocity}` : record.velocity != null ? String(record.velocity) : '—',
      resultLabel: result.label,
      resultClass: result.cls,
      rankScore: this.rankScore(record)
    };
  }

  formatSignalLabel(record: HistoricalSignalRecord): string {
    return formatAutonomousRegime(record.signalType, record.narrative ?? record.decision);
  }

  private resultMeta(record: HistoricalSignalRecord): { label: string; cls: 'win' | 'loss' | 'neutral' } {
    const r = record.actualR;
    if (r == null) return { label: '—', cls: 'neutral' };
    const sign = r >= 0 ? '+' : '';
    const cls = r >= 0.5 ? 'win' : r <= -0.5 ? 'loss' : 'neutral';
    return { label: `${sign}${r.toFixed(1)}R`, cls };
  }

  private rankScore(record: HistoricalSignalRecord): number {
    const conv = record.conviction ?? 0;
    const exp = record.expectancy ?? 0;
    const actual = record.actualR ?? 0;
    return conv * 0.4 + exp * 20 + actual * 15;
  }

  private formatTime(ts: number): string {
    try {
      return SignalExplorerEngine.timeFmt.format(new Date(ts));
    } catch {
      return '—';
    }
  }

  private formatDate(iso: string): string {
    try {
      return SignalExplorerEngine.dateFmt.format(new Date(iso + 'T12:00:00'));
    } catch {
      return iso;
    }
  }
}
