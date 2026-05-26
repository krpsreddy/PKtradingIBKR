import { Injectable } from '@angular/core';
import { MetricKey } from './execution-priority-matrix.service';
import {
  OpticalMetricSpec,
  OpticalSpacingResolver,
  OpticalSpacingSnapshot
} from './optical-spacing.resolver';

export interface RailCollisionInput {
  direction: string;
  metrics: OpticalMetricSpec[];
}

export interface RailCollisionSnapshot extends OpticalSpacingSnapshot {
  protectedKeys: MetricKey[];
  compressKeys: Array<MetricKey | 'dir'>;
  cssVars: Record<string, string>;
}

const MIN_METRIC_GAP = 18;
const MAX_METRIC_GAP = 24;
const PROTECTED: MetricKey[] = ['exit', 'stop', 'entry'];
const COMPRESS: Array<MetricKey | 'dir'> = ['rr', 'dir'];

@Injectable({ providedIn: 'root' })
export class ExecutionRailCollisionGuardService {
  constructor(private optical: OpticalSpacingResolver) {}

  resolve(input: RailCollisionInput): RailCollisionSnapshot {
    const snap = this.optical.resolve(input);
    const gapsAfter: Record<string, number> = {};

    for (const [key, gap] of Object.entries(snap.gapsAfter)) {
      gapsAfter[key] = Math.max(MIN_METRIC_GAP, Math.min(MAX_METRIC_GAP, gap));
    }

    const exitMetric = input.metrics.find(m => m.key === 'exit');
    const exitDominant = exitMetric?.exitDominant
      || exitMetric?.valueText.toUpperCase().includes('EXIT NOW');
    const exitReservePx = exitDominant ? Math.max(92, snap.exitReservePx - 16) : snap.exitReservePx;

    return {
      gapsAfter,
      rrRightGutterPx: Math.max(10, snap.rrRightGutterPx - 4),
      exitReservePx,
      protectedKeys: PROTECTED,
      compressKeys: COMPRESS,
      cssVars: {
        '--exit-reserve-px': `${exitReservePx}px`,
        '--rail-exit-size': '1.0625rem',
        '--rail-stop-size': '0.9375rem',
        '--rail-entry-size': '0.875rem',
        '--rail-rr-size': '0.8125rem',
        '--rail-tertiary-size': '0.75rem',
        '--rail-tertiary-opacity': '0.62',
        '--rail-min-gap': `${MIN_METRIC_GAP}px`
      }
    };
  }
}
