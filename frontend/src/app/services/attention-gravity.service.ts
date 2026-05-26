import { Injectable } from '@angular/core';
import { IntensityMode } from './situational-intensity.engine';

export type GravityField = 'exit' | 'stop' | 'entry' | 'trigger' | 'target' | 'rr' | 'rvol' | 'fail';
export type CorridorBias = 'target' | 'stop' | 'neutral';

export interface GravityInput {
  intensityMode: IntensityMode;
  exitNow: boolean;
  failPct: number;
  nearTrigger: boolean;
  triggerActive: boolean;
  rvol: number;
  estimatedRr: number | null;
  silenceActive: boolean;
  mtfAligned: boolean;
  trustRising: boolean;
}

export interface GravitySnapshot {
  weights: Record<GravityField, number>;
  railContrast: number;
  chartSharpness: number;
  sidebarLift: number;
  corridorBias: CorridorBias;
  silenceActive: boolean;
  targetFade: number;
  triggerSoftness: number;
  liveCandleDominance: number;
  labelWeights: Record<string, number>;
}

const FLAT = 0.42;

@Injectable({ providedIn: 'root' })
export class AttentionGravityService {
  resolve(input: GravityInput): GravitySnapshot {
    const w: Record<GravityField, number> = {
      exit: FLAT,
      stop: FLAT,
      entry: FLAT,
      trigger: FLAT,
      target: FLAT,
      rr: FLAT,
      rvol: FLAT,
      fail: FLAT
    };

    let corridorBias: CorridorBias = 'neutral';
    let railContrast = 0.72;
    let chartSharpness = 1;
    let sidebarLift = 0;
    let targetFade = 1;
    let triggerSoftness = 1;
    let liveCandleDominance = 0.55;

    if (input.silenceActive || input.intensityMode === 'CHOP') {
      Object.keys(w).forEach(k => { w[k as GravityField] = FLAT; });
      railContrast = 0.62;
      chartSharpness = 0.94;
      sidebarLift = 0;
      targetFade = 0.35;
      triggerSoftness = 0.55;
      liveCandleDominance = 0.32;
    } else if (input.exitNow || input.failPct >= 30 || input.intensityMode === 'FAILURE') {
      w.exit = 1;
      w.stop = 0.96;
      w.fail = 0.88;
      w.entry = 0.38;
      w.target = 0.18;
      w.trigger = 0.35;
      w.rr = 0.4;
      w.rvol = 0.45;
      corridorBias = 'stop';
      railContrast = 0.98;
      chartSharpness = 1.02;
      sidebarLift = 0.15;
      targetFade = 0.15;
      triggerSoftness = 0.65;
      liveCandleDominance = 0.62;
    } else if (input.intensityMode === 'BREAKOUT' || (input.triggerActive && input.rvol >= 2)) {
      w.entry = 1;
      w.trigger = 0.92;
      w.rvol = 0.85;
      w.target = 0.78;
      w.stop = 0.55;
      w.rr = input.estimatedRr != null && input.estimatedRr >= 2 ? 0.82 : 0.48;
      w.exit = 0.35;
      w.fail = 0.38;
      corridorBias = 'target';
      railContrast = 0.94;
      chartSharpness = 1.04;
      sidebarLift = 0.28;
      targetFade = 0.88;
      triggerSoftness = 1;
      liveCandleDominance = 0.92;
    } else if (input.intensityMode === 'TRIGGER' || input.nearTrigger) {
      w.entry = 0.88;
      w.trigger = 0.94;
      w.rvol = 0.72;
      w.target = 0.62;
      w.stop = 0.58;
      w.rr = input.estimatedRr != null && input.estimatedRr >= 2 ? 0.75 : 0.45;
      w.exit = 0.4;
      w.fail = 0.42;
      corridorBias = input.mtfAligned ? 'target' : 'neutral';
      railContrast = 0.86;
      chartSharpness = 1.02;
      sidebarLift = 0.22;
      targetFade = 0.72;
      triggerSoftness = 0.92;
      liveCandleDominance = 0.78;
    } else {
      w.entry = 0.62;
      w.stop = 0.58;
      w.target = 0.52;
      w.rr = input.estimatedRr != null && input.estimatedRr >= 2 ? 0.68 : 0.38;
      w.rvol = input.rvol >= 2.5 ? 0.65 : 0.45;
      railContrast = 0.68;
      chartSharpness = 0.98;
      liveCandleDominance = 0.48;
    }

    if (input.trustRising && !input.silenceActive) {
      w.entry = Math.min(1, w.entry + 0.06);
      chartSharpness = Math.min(1.06, chartSharpness + 0.02);
    }

    return {
      weights: w,
      railContrast,
      chartSharpness,
      sidebarLift,
      corridorBias,
      silenceActive: input.silenceActive,
      targetFade,
      triggerSoftness,
      liveCandleDominance,
      labelWeights: {
        Entry: w.entry,
        'Entry+': w.entry * 0.92,
        Stop: w.stop,
        Invalid: w.stop * 0.88,
        Target: w.target * targetFade,
        Trigger: w.trigger * triggerSoftness,
        Prev: 0.32
      }
    };
  }
}
