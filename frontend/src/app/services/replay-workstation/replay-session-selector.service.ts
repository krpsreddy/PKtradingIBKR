import { Injectable } from '@angular/core';
import { ReplaySessionCatalogEntry } from './replay-workstation.models';

@Injectable({ providedIn: 'root' })
export class ReplaySessionSelectorService {
  pickDefaultSession(
    sessions: ReplaySessionCatalogEntry[],
    persistedDate: string | null | undefined
  ): string | null {
    if (persistedDate && sessions.some(s => s.sessionDate === persistedDate)) {
      return persistedDate;
    }
    const ready = sessions.filter(s => s.replayReady);
    if (ready.length) return ready[ready.length - 1].sessionDate;
    return sessions.length ? sessions[sessions.length - 1].sessionDate : null;
  }
}
