import { Injectable } from '@angular/core';
import { IntensityMode } from './situational-intensity.engine';

export interface TertiaryRecoveryInput {
  intensityMode?: IntensityMode;
  immersive?: boolean;
  railLane?: boolean;
}

export interface TertiaryRecoverySnapshot {
  axisClearancePx: number;
  bottomPaddingPx: number;
  opacity: number;
  letterSpacing: string;
  cssVars: Record<string, string>;
}

/** Timestamp exclusion corridor — isolated from tertiary metrics. */
const X_AXIS_BAND_PX = 34;

@Injectable({ providedIn: 'root' })
export class TertiaryMetricRecoveryEngine {
  readonly axisClearancePx = 18;
  readonly opacityFloor = 0.62;
  readonly letterSpacing = '0.025em';

  resolve(input: TertiaryRecoveryInput = {}): TertiaryRecoverySnapshot {
    if (input.railLane) {
      const cssVars: Record<string, string> = {
        '--tertiary-clearance': '0px',
        '--tertiary-bottom-pad': '0px',
        '--tertiary-opacity': '0.62',
        '--tertiary-tracking': this.letterSpacing,
        '--tertiary-lift': '0px'
      };
      return {
        axisClearancePx: 0,
        bottomPaddingPx: 0,
        opacity: this.opacityFloor,
        letterSpacing: this.letterSpacing,
        cssVars
      };
    }

    const bottomPaddingPx = this.axisClearancePx + X_AXIS_BAND_PX + 7;
    const cssVars: Record<string, string> = {
      '--tertiary-clearance': `${this.axisClearancePx}px`,
      '--tertiary-bottom-pad': `${bottomPaddingPx}px`,
      '--tertiary-opacity': `${this.opacityFloor}`,
      '--tertiary-tracking': this.letterSpacing,
      '--tertiary-lift': '7px'
    };

    if (input.immersive) {
      cssVars['padding-bottom'] = `${bottomPaddingPx}px`;
    }

    return {
      axisClearancePx: this.axisClearancePx,
      bottomPaddingPx,
      opacity: this.opacityFloor,
      letterSpacing: this.letterSpacing,
      cssVars
    };
  }
}
