import { Injectable } from '@angular/core';
import { BandMetrics, CONVICTION_BANDS, ConvictionDistribution, GroupStat } from './analytics-query.models';

/** Client-side formatting for conviction histogram and stat bars. */
@Injectable({ providedIn: 'root' })
export class AnalyticsDistributionEngine {
  bandRows(dist: ConvictionDistribution | null): { id: string; label: string; metrics: BandMetrics }[] {
    if (!dist) return [];
    return [
      { id: 'ELITE', label: CONVICTION_BANDS[0].label, metrics: dist.elite },
      { id: 'HIGH', label: CONVICTION_BANDS[1].label, metrics: dist.high },
      { id: 'MODERATE', label: CONVICTION_BANDS[2].label, metrics: dist.moderate },
      { id: 'LOW', label: CONVICTION_BANDS[3].label, metrics: dist.low },
      { id: 'AVOID', label: CONVICTION_BANDS[4].label, metrics: dist.avoid }
    ];
  }

  maxCount(stats: GroupStat[]): number {
    return stats.reduce((m, s) => Math.max(m, s.count), 1);
  }

  barWidth(count: number, max: number): number {
    return Math.max(4, Math.round((count / max) * 100));
  }

  severityClass(severity: string): string {
    switch (severity) {
      case 'WARN': return 'sev-warn';
      case 'INFO': return 'sev-info';
      default: return 'sev-ok';
    }
  }

  formatPct(v: number): string {
    return `${v.toFixed(1)}%`;
  }

  formatR(v: number): string {
    const sign = v >= 0 ? '+' : '';
    return `${sign}${v.toFixed(2)}R`;
  }
}
