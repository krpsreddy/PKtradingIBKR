import { Injectable } from '@angular/core';
import { IntensityMode } from './situational-intensity.engine';

export interface ScaleDensityInput {
  intensityMode: IntensityMode;
  executionLevelPrices?: number[];
}

export interface ScaleDensitySnapshot {
  sparse: boolean;
  layoutFontSize: number;
  entireTextOnly: boolean;
  marginExpand: number;
  alignLabels: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdaptiveScaleDensityService {
  resolve(input: ScaleDensityInput): ScaleDensitySnapshot {
    const calm = input.intensityMode === 'CHOP' || input.intensityMode === 'CALM';
    const dense = input.intensityMode === 'BREAKOUT' || input.intensityMode === 'TRIGGER';

    if (dense) {
      return {
        sparse: false,
        layoutFontSize: 11,
        entireTextOnly: false,
        marginExpand: 0,
        alignLabels: true
      };
    }

    if (calm) {
      return {
        sparse: true,
        layoutFontSize: 12,
        entireTextOnly: true,
        marginExpand: 0.05,
        alignLabels: true
      };
    }

    return {
      sparse: false,
      layoutFontSize: 12,
      entireTextOnly: false,
      marginExpand: 0.02,
      alignLabels: true
    };
  }
}
