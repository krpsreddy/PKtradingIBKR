import { Injectable } from '@angular/core';
import { ReplaySessionCatalogEntry } from './replay-workstation.models';

@Injectable({ providedIn: 'root' })
export class ReplaySessionNavigationEngine {
  previousSession(sessions: ReplaySessionCatalogEntry[], currentDate: string): ReplaySessionCatalogEntry | null {
    const sorted = this.sortedReady(sessions);
    const idx = sorted.findIndex(s => s.sessionDate === currentDate);
    if (idx <= 0) return null;
    return sorted[idx - 1];
  }

  nextSession(sessions: ReplaySessionCatalogEntry[], currentDate: string): ReplaySessionCatalogEntry | null {
    const sorted = this.sortedReady(sessions);
    const idx = sorted.findIndex(s => s.sessionDate === currentDate);
    if (idx < 0 || idx >= sorted.length - 1) return null;
    return sorted[idx + 1];
  }

  bestSetupSession(sessions: ReplaySessionCatalogEntry[]): ReplaySessionCatalogEntry | null {
    const ready = this.sortedReady(sessions);
    if (!ready.length) return null;
    return [...ready].sort((a, b) => b.signalCount - a.signalCount)[0];
  }

  highConvictionSession(sessions: ReplaySessionCatalogEntry[]): ReplaySessionCatalogEntry | null {
    const ready = this.sortedReady(sessions).filter(s => s.signalCount >= 3);
    return ready.length ? ready[ready.length - 1] : this.bestSetupSession(sessions);
  }

  latestReadySession(sessions: ReplaySessionCatalogEntry[]): ReplaySessionCatalogEntry | null {
    const ready = this.sortedReady(sessions);
    return ready.length ? ready[ready.length - 1] : null;
  }

  private sortedReady(sessions: ReplaySessionCatalogEntry[]): ReplaySessionCatalogEntry[] {
    return [...sessions].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  }
}
