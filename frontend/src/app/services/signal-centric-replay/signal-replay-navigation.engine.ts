import { Injectable } from '@angular/core';
import { SignalCentricRow } from './signal-centric-replay.models';

export type SignalIndexNavKind = 'NEXT' | 'PREV' | 'FIRST' | 'LAST';

/** Navigate filtered signal index list (cross-session). */
@Injectable({ providedIn: 'root' })
export class SignalReplayNavigationEngine {
  indexOf(rows: SignalCentricRow[], signalId: string | null): number {
    if (!signalId) return -1;
    return rows.findIndex(r => r.signalId === signalId);
  }

  navigate(rows: SignalCentricRow[], signalId: string | null, kind: SignalIndexNavKind): SignalCentricRow | null {
    if (!rows.length) return null;
    const idx = this.indexOf(rows, signalId);
    switch (kind) {
      case 'FIRST':
        return rows[0];
      case 'LAST':
        return rows[rows.length - 1];
      case 'NEXT':
        return idx < 0 ? rows[0] : rows[Math.min(idx + 1, rows.length - 1)] ?? null;
      case 'PREV':
        return idx <= 0 ? rows[0] : rows[idx - 1] ?? null;
      default:
        return null;
    }
  }

  nextInSession(rows: SignalCentricRow[], signalId: string, sessionDate: string): SignalCentricRow | null {
    const idx = this.indexOf(rows, signalId);
    if (idx < 0) return null;
    for (let i = idx + 1; i < rows.length; i++) {
      if (rows[i].sessionDate === sessionDate) return rows[i];
    }
    return null;
  }

  prevInSession(rows: SignalCentricRow[], signalId: string, sessionDate: string): SignalCentricRow | null {
    const idx = this.indexOf(rows, signalId);
    if (idx < 0) return null;
    for (let i = idx - 1; i >= 0; i--) {
      if (rows[i].sessionDate === sessionDate) return rows[i];
    }
    return null;
  }
}
