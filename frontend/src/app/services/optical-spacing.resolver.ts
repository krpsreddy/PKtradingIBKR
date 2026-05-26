import { Injectable } from '@angular/core';
import { MetricKey } from './execution-priority-matrix.service';

export interface OpticalMetricSpec {
  key: MetricKey | 'dir';
  labelText: string;
  valueText: string;
  magnet: boolean;
  exitDominant?: boolean;
}

export interface OpticalSpacingSnapshot {
  gapsAfter: Record<string, number>;
  rrRightGutterPx: number;
  exitReservePx: number;
}

const LABEL_PX = 6.2;
const VALUE_PX_NORMAL = 7.2;
const VALUE_PX_BOLD = 8.6;
const KV_GAP = 7;
const EXIT_NOW_MIN_GAP = 26;
const EXIT_RESERVE_PX = 92;

@Injectable({ providedIn: 'root' })
export class OpticalSpacingResolver {
  resolve(input: { direction: string; metrics: OpticalMetricSpec[] }): OpticalSpacingSnapshot {
    const gapsAfter: Record<string, number> = {};
    const widths = new Map<string, number>();

    widths.set('dir', this.estimateDir(input.direction));

    for (const m of input.metrics) {
      widths.set(m.key, this.estimateMetric(m));
    }

    const order: Array<MetricKey | 'dir'> = ['dir', ...input.metrics.map(m => m.key)];

    for (let i = 0; i < order.length - 1; i++) {
      const key = order[i];
      const nextKey = order[i + 1];
      const w = widths.get(key) ?? 0;
      const nextW = widths.get(nextKey) ?? 0;
      const metric = input.metrics.find(m => m.key === key);
      const nextMetric = input.metrics.find(m => m.key === nextKey);
      gapsAfter[key] = this.opticalGap(key, w, nextW, metric, nextMetric);
    }

    const exitMetric = input.metrics.find(m => m.key === 'exit');
    const exitReservePx = exitMetric?.exitDominant || exitMetric?.valueText.toUpperCase().includes('EXIT')
      ? EXIT_RESERVE_PX
      : 0;

    return {
      gapsAfter,
      rrRightGutterPx: 14,
      exitReservePx
    };
  }

  private estimateDir(direction: string): number {
    const text = direction.toUpperCase();
    return text.length * 5.8 + 4;
  }

  private estimateMetric(m: OpticalMetricSpec): number {
    if (m.key === 'exit' && m.exitDominant) {
      return m.valueText.length * 8.2 + 24;
    }
    const labelW = m.exitDominant ? 0 : m.labelText.length * LABEL_PX;
    const valPx = m.magnet ? VALUE_PX_BOLD : VALUE_PX_NORMAL;
    let valW = m.valueText.length * valPx;
    if (m.magnet) valW += 10;
    if (/^\$/.test(m.valueText)) valW += 4;
    if (m.valueText.toUpperCase().includes('EXIT')) valW += 16;
    return labelW + (m.exitDominant ? 0 : KV_GAP) + valW;
  }

  private opticalGap(
    key: string,
    width: number,
    nextWidth: number,
    metric?: OpticalMetricSpec,
    nextMetric?: OpticalMetricSpec
  ): number {
    let gap = Math.max(14, Math.round((width + nextWidth) * 0.06));

    if (key === 'dir') gap = Math.max(gap, 20);
    if (key === 'entry') gap = Math.max(gap, 22);
    if (key === 'stop') gap = Math.max(gap, 22);
    if (key === 'exit') {
      gap = Math.max(gap, EXIT_NOW_MIN_GAP);
      if (metric?.valueText.toUpperCase().includes('EXIT')) gap += 8;
      if (metric?.magnet || metric?.exitDominant) gap += 6;
    }

    if (nextMetric?.exitDominant || nextMetric?.valueText.toUpperCase().includes('EXIT NOW')) {
      gap = Math.max(gap, EXIT_NOW_MIN_GAP);
    }

    if (key === 'entry' || key === 'stop') {
      gap = Math.max(gap, 20);
    }

    return Math.round(gap / 2) * 2;
  }
}
