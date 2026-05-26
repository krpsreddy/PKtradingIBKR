import { Injectable } from '@angular/core';
import { SignalCentricFilters, SignalCentricRow, SignalSmartShortcut } from './signal-centric-replay.models';

/** Client-side filter/sort for signal-centric explorer rows. */
@Injectable({ providedIn: 'root' })
export class SignalExplorerStateService {
  applyFilters(rows: SignalCentricRow[], filters: SignalCentricFilters): SignalCentricRow[] {
    let out = [...rows];

    if (filters.conviction !== 'ALL') {
      out = out.filter(r => this.matchesConvictionBand(r, filters.conviction));
    }

    const q = filters.searchText.trim().toLowerCase();
    if (q) {
      out = out.filter(r =>
        r.signalLabel.toLowerCase().includes(q)
        || r.narrative?.toLowerCase().includes(q)
        || r.sessionDate.includes(q)
        || r.dateLabel.toLowerCase().includes(q)
      );
    }

    out.sort((a, b) => {
      switch (filters.sort) {
        case 'CONVICTION':
          return (b.conviction ?? 0) - (a.conviction ?? 0);
        case 'RESULT_R':
          return (b.resultR ?? b.mfe ?? 0) - (a.resultR ?? a.mfe ?? 0);
        case 'TIME_DESC':
        default:
          return b.timestamp - a.timestamp;
      }
    });

    return out;
  }

  shortcutFilter(shortcut: SignalSmartShortcut): Partial<SignalCentricFilters> {
    switch (shortcut) {
      case 'BEST_WINNERS':
        return { result: 'WINNERS', sort: 'RESULT_R' };
      case 'BIGGEST_FAILURES':
        return { result: 'LOSERS', sort: 'RESULT_R' };
      case 'ELITE_RECLAIMS':
        return { narrative: 'VWAP_RECLAIM', quality: 'INSTITUTIONAL' };
      case 'TRAP_DAYS':
        return { quality: 'TRAP', result: 'FAKEOUTS' };
      case 'HIGH_CONVICTION':
        return { conviction: 'HIGH' };
      case 'FAILED_HIGH_CONVICTION':
        return { conviction: 'HIGH', result: 'LOSERS' };
      case 'BEST_SECOND_LEGS':
        return { narrative: 'SECOND_LEG', sort: 'RESULT_R' };
      default:
        return {};
    }
  }

  applyShortcut(rows: SignalCentricRow[], shortcut: SignalSmartShortcut, base: SignalCentricFilters): SignalCentricRow[] {
    const partial = this.shortcutFilter(shortcut);
    return this.applyFilters(rows, { ...base, ...partial });
  }

  private matchesConvictionBand(row: SignalCentricRow, band: string): boolean {
    const c = row.conviction ?? 0;
    switch (band) {
      case 'ELITE': return c >= 80;
      case 'HIGH': return c >= 70;
      case 'MEDIUM': return c >= 50 && c < 70;
      case 'LOW': return c < 50;
      default: return true;
    }
  }

  private emptyFilters(): SignalCentricFilters {
    return {
      decision: 'ALL',
      narrative: 'ALL',
      quality: 'ALL',
      result: 'ALL',
      conviction: 'ALL',
      timeWindowDays: 60,
      searchText: '',
      sort: 'TIME_DESC'
    };
  }
}
