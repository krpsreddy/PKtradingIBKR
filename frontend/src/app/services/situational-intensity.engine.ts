import { Injectable } from '@angular/core';

export type IntensityMode = 'CALM' | 'FOCUS' | 'TRIGGER' | 'BREAKOUT' | 'FAILURE' | 'CHOP';

export interface IntensityInput {
  marketChoppy: boolean;
  noEdge: boolean;
  exitNow: boolean;
  failPct: number;
  rvol: number;
  nearTrigger: boolean;
  triggerActive: boolean;
  tradeActive: boolean;
  continuationRising: boolean;
  weakRr: boolean;
  lowTrust: boolean;
  thetaDanger: boolean;
  staleTrigger: boolean;
  staleSetup: boolean;
  tensionScore: number;
}

export interface IntensitySnapshot {
  mode: IntensityMode;
  saturation: number;
  pulseAllowed: boolean;
  sidebarOpacity: number;
  gridHorz: number;
  gridVert: number;
  liveEnergy: number;
  overlayEnergy: number;
  calmMode: boolean;
  urgencyActive: boolean;
  chartContrast: number;
  railDim: number;
  labelSharpness: number;
  failurePressure: boolean;
  maDepth: number;
  historyFade: number;
  candleEmphasis: number;
}

@Injectable({ providedIn: 'root' })
export class SituationalIntensityEngine {
  resolve(input: IntensityInput): IntensitySnapshot {
    const chopSilence = input.marketChoppy
      || (input.weakRr && input.lowTrust)
      || input.thetaDanger
      || input.staleTrigger
      || input.staleSetup
      || input.noEdge;

    if (chopSilence && !input.exitNow && !input.triggerActive && input.failPct < 28) {
      return this.pack('CHOP', 0.28, false, 0.32, 0.12, 0.08, 0.15, 0.15, 0.86, 0.28, 0.38, false, 0.12, 0.2, 0.18);
    }
    if (input.exitNow || input.failPct >= 38) {
      return this.pack('FAILURE', 0.72, false, 0.58, 0.32, 0.22, 0.42, 0.88, 0.96, 0.98, 0.98, true, 0.5, 0.22, 0.55);
    }
    if (input.triggerActive && (input.rvol >= 2 || input.tensionScore >= 50)) {
      return this.pack('BREAKOUT', 0.88, true, 0.78, 0.38, 0.28, 0.68 + input.tensionScore * 0.001, 0.94, 1.05, 1, 0.98, false, 0.55, 0.38, 0.82);
    }
    if (input.nearTrigger || input.triggerActive || input.tensionScore >= 42) {
      return this.pack('TRIGGER', 0.78, true, 0.68, 0.34, 0.24, 0.52 + input.tensionScore * 0.001, 0.76, 1.02, 0.92, 0.88, false, 0.48, 0.32, 0.68);
    }
    if (input.tradeActive || input.continuationRising || input.rvol >= 2) {
      return this.pack('FOCUS', 0.64, true, 0.52, 0.26, 0.18, 0.48, 0.48, 1, 0.72, 0.68, false, 0.42, 0.28, 0.58);
    }
    return this.pack('CALM', 0.38, false, 0.42, 0.16, 0.1, 0.28, 0.18, 0.9, 0.48, 0.5, false, 0.38, 0.18, 0.35);
  }

  private pack(
    mode: IntensityMode,
    saturation: number,
    pulseAllowed: boolean,
    sidebarOpacity: number,
    gridHorz: number,
    gridVert: number,
    liveEnergy: number,
    overlayEnergy: number,
    chartContrast: number,
    railDim: number,
    labelSharpness: number,
    failurePressure: boolean,
    maDepth: number,
    historyFade: number,
    candleEmphasis: number
  ): IntensitySnapshot {
    const urgencyActive = mode === 'FAILURE' || mode === 'BREAKOUT' || mode === 'TRIGGER';
    return {
      mode,
      saturation,
      pulseAllowed,
      sidebarOpacity,
      gridHorz,
      gridVert,
      liveEnergy,
      overlayEnergy,
      calmMode: mode === 'CALM' || mode === 'CHOP',
      urgencyActive,
      chartContrast,
      railDim,
      labelSharpness,
      failurePressure,
      maDepth,
      historyFade,
      candleEmphasis
    };
  }
}
