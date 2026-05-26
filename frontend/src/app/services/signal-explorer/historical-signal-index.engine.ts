import { Injectable } from '@angular/core';
import { HistoricalSignalRecord, SignalExplorerRow } from './signal-explorer.models';

export interface DaySignalHeat {
  sessionDate: string;
  label: string;
  signalCount: number;
  avgR: number;
  tone: 'strong' | 'mixed' | 'weak' | 'empty';
}

@Injectable({ providedIn: 'root' })
export class HistoricalSignalIndexEngine {
  byDate(rows: SignalExplorerRow[]): Map<string, SignalExplorerRow[]> {
    const map = new Map<string, SignalExplorerRow[]>();
    for (const row of rows) {
      const list = map.get(row.sessionDate) ?? [];
      list.push(row);
      map.set(row.sessionDate, list);
    }
    return map;
  }

  heatmap(rows: SignalExplorerRow[], days = 60): DaySignalHeat[] {
    const byDate = this.byDate(rows);
    const out: DaySignalHeat[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const dayRows = byDate.get(iso) ?? [];
      const avgR = dayRows.length
        ? dayRows.reduce((s, r) => s + (r.actualR ?? 0), 0) / dayRows.length
        : 0;
      out.push({
        sessionDate: iso,
        label: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d),
        signalCount: dayRows.length,
        avgR,
        tone: dayRows.length === 0 ? 'empty' : avgR >= 1 ? 'strong' : avgR >= 0 ? 'mixed' : 'weak'
      });
    }
    return out;
  }

  dedupe(records: HistoricalSignalRecord[]): HistoricalSignalRecord[] {
    const seen = new Set<string>();
    const out: HistoricalSignalRecord[] = [];
    for (const r of records) {
      if (seen.has(r.signalId)) continue;
      seen.add(r.signalId);
      out.push(r);
    }
    return out;
  }
}
