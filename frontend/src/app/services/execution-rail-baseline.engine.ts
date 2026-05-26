import { Injectable } from '@angular/core';
import { MetricKey } from './execution-priority-matrix.service';

export type RailSpacingKey = 'dir' | MetricKey;

export interface RailBaselineSnapshot {
  rhythmPx: number;
  primaryMinHeightPx: number;
  secondaryOffsetPx: number;
  spacingAfter: Record<RailSpacingKey, number>;
  cssVars: Record<string, string>;
}

const SPACING: Record<RailSpacingKey, number> = {
  dir: 20,
  entry: 24,
  stop: 24,
  exit: 28,
  rr: 18
};

@Injectable({ providedIn: 'root' })
export class ExecutionRailBaselineEngine {
  readonly rhythmPx = 4;

  resolve(): RailBaselineSnapshot {
    const cssVars: Record<string, string> = {
      '--rail-rhythm': `${this.rhythmPx}px`,
      '--rail-primary-min-h': `${this.rhythmPx * 5}px`,
      '--rail-secondary-offset': `${this.rhythmPx}px`
    };
    for (const [key, px] of Object.entries(SPACING)) {
      cssVars[`--rail-gap-${key}`] = `${px}px`;
    }
    return {
      rhythmPx: this.rhythmPx,
      primaryMinHeightPx: this.rhythmPx * 4,
      secondaryOffsetPx: this.rhythmPx,
      spacingAfter: { ...SPACING },
      cssVars
    };
  }

  gapAfter(key: RailSpacingKey): number {
    return SPACING[key];
  }
}
