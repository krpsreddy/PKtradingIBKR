import { Injectable } from '@angular/core';
import { SignalExplorerRow } from './signal-explorer.models';

export type SignalNavKind =
  | 'NEXT'
  | 'PREV'
  | 'ELITE'
  | 'TRAP'
  | 'RECLAIM'
  | 'SECOND_LEG';

@Injectable({ providedIn: 'root' })
export class SignalNavigationEngine {
  navigate(
    rows: SignalExplorerRow[],
    currentId: string | null,
    kind: SignalNavKind
  ): SignalExplorerRow | null {
    if (!rows.length) return null;
    const idx = currentId ? rows.findIndex(r => r.signalId === currentId) : -1;

    switch (kind) {
      case 'NEXT':
        return rows[Math.min(idx + 1, rows.length - 1)] ?? rows[0];
      case 'PREV':
        return rows[Math.max(idx - 1, 0)] ?? rows[rows.length - 1];
      case 'ELITE':
        return this.findNext(rows, idx, r => (r.conviction ?? 0) >= 80);
      case 'TRAP':
        return this.findNext(rows, idx, r =>
          (r.decision ?? '').includes('TRAP') || (r.fakeoutRisk ?? 0) >= 0.5);
      case 'RECLAIM':
        return this.findNext(rows, idx, r =>
          `${r.decision} ${r.narrative}`.toUpperCase().includes('RECLAIM'));
      case 'SECOND_LEG':
        return this.findNext(rows, idx, r =>
          `${r.decision} ${r.narrative}`.toUpperCase().includes('SECOND')
          || `${r.decision} ${r.narrative}`.toUpperCase().includes('CONT'));
      default:
        return null;
    }
  }

  indexOf(rows: SignalExplorerRow[], signalId: string | null): number {
    if (!signalId) return -1;
    return rows.findIndex(r => r.signalId === signalId);
  }

  private findNext(
    rows: SignalExplorerRow[],
    fromIdx: number,
    pred: (r: SignalExplorerRow) => boolean
  ): SignalExplorerRow | null {
    for (let i = fromIdx + 1; i < rows.length; i++) {
      if (pred(rows[i])) return rows[i];
    }
    for (let i = 0; i <= fromIdx; i++) {
      if (pred(rows[i])) return rows[i];
    }
    return null;
  }
}
