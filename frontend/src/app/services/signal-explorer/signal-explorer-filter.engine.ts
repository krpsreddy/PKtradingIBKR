import { Injectable } from '@angular/core';
import {
  SignalExplorerFilters,
  SignalExplorerRow,
  SignalTimeWindow
} from './signal-explorer.models';

const EXIT_DECISIONS = new Set(['EXIT_NOW', 'STOP_HIT', 'TARGET_HIT', 'BREAKDOWN_EXIT', 'TRAIL_EXIT']);
const RISK_DECISIONS = new Set(['TRAP_RISK', 'EXHAUSTION', 'LIQUIDITY_SWEEP', 'LATE_CHASE', 'FAILED_ACCEPTANCE']);

@Injectable({ providedIn: 'root' })
export class SignalExplorerFilterEngine {
  apply(rows: SignalExplorerRow[], filters: SignalExplorerFilters): SignalExplorerRow[] {
    const q = filters.searchText.trim().toLowerCase();
    const { fromTs, toTs } = this.timeBounds(filters.timeWindow);

    let out = rows.filter(r => {
      if (fromTs != null && r.timestampMs < fromTs) return false;
      if (toTs != null && r.timestampMs > toTs) return false;
      if (filters.highConvictionOnly && (r.conviction ?? 0) < 75) return false;
      if (filters.side === 'BUY' && EXIT_DECISIONS.has(r.decision)) return false;
      if (filters.side === 'SELL' && !EXIT_DECISIONS.has(r.decision) && !RISK_DECISIONS.has(r.decision)) return false;
      if (filters.decision !== 'ALL' && !this.matchesDecision(r, filters.decision)) return false;
      if (filters.narrative !== 'ALL' && !this.matchesNarrative(r, filters.narrative)) return false;
      if (filters.quality !== 'ALL' && !this.matchesQuality(r, filters.quality)) return false;
      if (filters.result !== 'ALL' && !this.matchesResult(r, filters.result)) return false;
      if (q && !this.matchesSearch(r, q)) return false;
      return true;
    });

    out = this.sort(out, filters.sort);
    return out;
  }

  private timeBounds(window: SignalTimeWindow): { fromTs: number | null; toTs: number | null } {
    const now = Date.now();
    const day = 86_400_000;
    switch (window) {
      case 'TODAY': return { fromTs: now - day, toTs: now };
      case '5D': return { fromTs: now - 5 * day, toTs: now };
      case '20D': return { fromTs: now - 20 * day, toTs: now };
      case '60D':
      default: return { fromTs: now - 60 * day, toTs: now };
    }
  }

  private matchesDecision(row: SignalExplorerRow, filter: string): boolean {
    const d = (row.decision ?? '').toUpperCase();
    const n = (row.narrative ?? '').toUpperCase();
    const f = filter.toUpperCase();
    if (d.includes(f) || n.includes(f)) return true;
    if (f === 'RECLAIM_ENTRY' && (d.includes('RECLAIM') || n.includes('RECLAIM'))) return true;
    if (f === 'SECOND_LEG' && (d.includes('SECOND') || n.includes('SECOND') || d.includes('CONT'))) return true;
    return false;
  }

  private matchesNarrative(row: SignalExplorerRow, filter: string): boolean {
    const blob = `${row.narrative ?? ''} ${row.decision ?? ''} ${row.signalLabel}`.toUpperCase();
    const f = filter.replace(/_/g, ' ').toUpperCase();
    return blob.includes(f) || blob.includes(filter.toUpperCase());
  }

  private matchesQuality(row: SignalExplorerRow, filter: string): boolean {
    switch (filter) {
      case 'ELITE': return (row.conviction ?? 0) >= 80;
      case 'HIGH': return (row.conviction ?? 0) >= 70;
      case 'INSTITUTIONAL': return (row.entryQuality ?? '').toUpperCase().includes('INSTITUTIONAL');
      case 'LOW_FAKEOUT': return (row.fakeoutRisk ?? 0) < 0.35;
      case 'HIGH_EXPECTANCY': return (row.expectancy ?? 0) >= 2;
      default: return true;
    }
  }

  private matchesResult(row: SignalExplorerRow, filter: string): boolean {
    const r = row.actualR;
    switch (filter) {
      case 'WINNERS': return (r ?? 0) > 0;
      case 'LOSERS': return (r ?? 0) < 0;
      case 'GT_2R': return (r ?? 0) >= 2;
      case 'TRAP_AVOIDED': return (row.fakeoutRisk ?? 0) >= 0.5 && (r ?? 0) >= 0;
      case 'FAKEOUTS': return (r ?? 0) < 0 && (row.fakeoutRisk ?? 0) >= 0.4;
      default: return true;
    }
  }

  private matchesSearch(row: SignalExplorerRow, q: string): boolean {
    const blob = [
      row.symbol,
      row.decision,
      row.narrative,
      row.signalLabel,
      row.dateLabel,
      row.timeLabel
    ].join(' ').toLowerCase();
    return q.split(/\s+/).every(token => blob.includes(token));
  }

  private sort(rows: SignalExplorerRow[], mode: SignalExplorerFilters['sort']): SignalExplorerRow[] {
    const copy = [...rows];
    switch (mode) {
      case 'CONVICTION':
        return copy.sort((a, b) => (b.conviction ?? 0) - (a.conviction ?? 0));
      case 'EXPECTANCY':
        return copy.sort((a, b) => (b.expectancy ?? 0) - (a.expectancy ?? 0));
      case 'ACTUAL_R':
        return copy.sort((a, b) => (b.actualR ?? 0) - (a.actualR ?? 0));
      case 'TIME_DESC':
      default:
        return copy.sort((a, b) => b.timestampMs - a.timestampMs);
    }
  }
}
