import { Injectable } from '@angular/core';
import { SignalExplorerDiscovery, SignalExplorerRow } from './signal-explorer.models';

@Injectable({ providedIn: 'root' })
export class SignalQualityRankingEngine {
  buildDiscovery(rows: SignalExplorerRow[]): SignalExplorerDiscovery {
    const byExpectancy = [...rows].sort((a, b) => (b.expectancy ?? 0) - (a.expectancy ?? 0));
    const byConviction = [...rows].sort((a, b) => (b.conviction ?? 0) - (a.conviction ?? 0));
    const secondLeg = rows.filter(r =>
      `${r.decision} ${r.narrative}`.toUpperCase().includes('SECOND')
      || `${r.decision} ${r.narrative}`.toUpperCase().includes('CONT'));
    const reclaims = rows.filter(r =>
      `${r.decision} ${r.narrative}`.toUpperCase().includes('RECLAIM'));
    const traps = rows.filter(r =>
      (r.fakeoutRisk ?? 0) >= 0.45 || (r.decision ?? '').includes('TRAP'));
    const chases = rows.filter(r =>
      (r.decision ?? '').includes('LATE') || ((r.actualR ?? 0) < -1 && (r.conviction ?? 0) < 60));

    return {
      bestExpectancy: byExpectancy.slice(0, 5),
      highestConviction: byConviction.slice(0, 5),
      bestSecondLeg: [...secondLeg].sort((a, b) => (b.actualR ?? 0) - (a.actualR ?? 0)).slice(0, 5),
      safestReclaims: [...reclaims]
        .filter(r => (r.fakeoutRisk ?? 1) < 0.35)
        .sort((a, b) => (b.actualR ?? 0) - (a.actualR ?? 0))
        .slice(0, 5),
      dangerousTraps: [...traps].sort((a, b) => (a.actualR ?? 0) - (b.actualR ?? 0)).slice(0, 5),
      worstChases: [...chases].sort((a, b) => (a.actualR ?? 0) - (b.actualR ?? 0)).slice(0, 5),
      clusters: []
    };
  }
}
