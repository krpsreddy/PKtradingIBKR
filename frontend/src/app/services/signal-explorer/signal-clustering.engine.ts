import { Injectable } from '@angular/core';
import { SignalCluster, SignalExplorerRow } from './signal-explorer.models';

@Injectable({ providedIn: 'root' })
export class SignalClusteringEngine {
  cluster(rows: SignalExplorerRow[]): SignalCluster[] {
    const buckets = new Map<string, SignalExplorerRow[]>();

    for (const row of rows) {
      const key = this.clusterKey(row);
      const list = buckets.get(key) ?? [];
      list.push(row);
      buckets.set(key, list);
    }

    return [...buckets.entries()]
      .map(([key, items]) => ({
        id: key,
        label: key.replace(/_/g, ' '),
        narrative: items[0]?.narrative ?? key,
        count: items.length,
        avgR: items.reduce((s, r) => s + (r.actualR ?? 0), 0) / items.length,
        avgConviction: items.reduce((s, r) => s + (r.conviction ?? 0), 0) / items.length,
        signalIds: items.map(i => i.signalId)
      }))
      .filter(c => c.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  private clusterKey(row: SignalExplorerRow): string {
    const blob = `${row.narrative ?? ''} ${row.decision ?? ''}`.toUpperCase();
    if (blob.includes('RECLAIM') && blob.includes('CONT')) return 'RECLAIM_CONTINUATION';
    if (blob.includes('FAILED') && blob.includes('RECLAIM')) return 'FAILED_BREAKOUT_RECLAIM';
    if (blob.includes('SECOND') || blob.includes('CONT_BUY')) return 'SECOND_LEG_ACCEPTANCE';
    if (blob.includes('VWAP')) return 'VWAP_RECLAIM';
    if (blob.includes('TRAP') || blob.includes('FAIL')) return 'TRAP_RISK';
    if (blob.includes('BREAKOUT')) return 'BREAKOUT';
    return (row.narrative ?? row.decision ?? 'MIXED').toUpperCase().slice(0, 32);
  }
}
