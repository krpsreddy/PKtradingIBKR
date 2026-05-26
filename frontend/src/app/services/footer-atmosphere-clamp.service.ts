import { Injectable } from '@angular/core';

export interface FooterAtmosphereInput {
  chartHeightPx?: number;
  railActive?: boolean;
}

export interface FooterAtmosphereSnapshot {
  atmosphereMaxPx: number;
  atmosphereRatio: number;
  volumeEdgeFloor: number;
  cssVars: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class FooterAtmosphereClampService {
  /** Clamp atmosphere band to 18–24% of chart height. */
  resolve(input: FooterAtmosphereInput = {}): FooterAtmosphereSnapshot {
    const h = input.chartHeightPx ?? 380;
    const ratio = 0.21;
    const atmosphereMaxPx = Math.round(Math.max(38, Math.min(48, h * ratio)));
    const volumeEdgeFloor = input.railActive ? 0.58 : 1;

    return {
      atmosphereMaxPx,
      atmosphereRatio: ratio,
      volumeEdgeFloor,
      cssVars: {
        '--footer-atmosphere-max': `${atmosphereMaxPx}px`,
        '--footer-atmosphere-ratio': `${ratio}`,
        '--rail-volume-fade': `${atmosphereMaxPx}px`,
        '--volume-edge-floor': `${volumeEdgeFloor}`
      }
    };
  }
}
