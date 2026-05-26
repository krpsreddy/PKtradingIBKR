import { Injectable } from '@angular/core';
import { IntensityMode } from './situational-intensity.engine';

export interface BreathingInput {
  tensionScore: number;
  regime: string | null;
  rvol: number;
  triggerProximityPct: number | null;
  failureProbability: number;
  intensityMode: IntensityMode;
  silenceActive: boolean;
  chartTightness?: number;
  ambientBreathing?: number;
}

export interface BreathingSnapshot {
  ambientDrift: number;
  environmentalPressure: number;
  workspaceBreathing: number;
  holdBreath: number;
  focusCompression: number;
  luminanceReduction: number;
}

@Injectable({ providedIn: 'root' })
export class MarketBreathingEngine {
  resolve(input: BreathingInput): BreathingSnapshot {
    const norm = Math.min(1, input.tensionScore / 100);
    const nearTrigger = input.triggerProximityPct != null && input.triggerProximityPct < 1.2;
    const choppy = input.regime === 'CHOPPY' || input.intensityMode === 'CHOP';
    const tight = input.chartTightness ?? 1;
    const ambient = input.ambientBreathing ?? 1;

    let ambientDrift = 1;
    let environmentalPressure = 0;
    let workspaceBreathing = 1;
    let holdBreath = 0;
    let focusCompression = 1;
    let luminanceReduction = 0;

    if (input.silenceActive || choppy) {
      ambientDrift = 0.98;
      environmentalPressure = 0.02;
      workspaceBreathing = 0.97;
      holdBreath = 0.15;
      focusCompression = 0.92;
      luminanceReduction = 0.02;
    } else if (input.intensityMode === 'FAILURE' || input.failureProbability >= 35) {
      ambientDrift = 0.992;
      environmentalPressure = 0.07 + Math.min(0.05, input.failureProbability * 0.001);
      workspaceBreathing = 0.985;
      holdBreath = 0.55 + norm * 0.2;
      focusCompression = 0.88 + norm * 0.06;
      luminanceReduction = 0.03;
    } else if (input.intensityMode === 'BREAKOUT' || input.intensityMode === 'TRIGGER') {
      ambientDrift = 1.006 + norm * 0.004;
      environmentalPressure = -0.025 - norm * 0.015;
      workspaceBreathing = 1.008 + (nearTrigger ? 0.003 : 0);
      holdBreath = 0.35 + norm * 0.25;
      focusCompression = 0.86 + norm * 0.08;
      luminanceReduction = 0.02;
    } else if (input.intensityMode === 'CALM') {
      ambientDrift = 0.996;
      environmentalPressure = 0.008;
      workspaceBreathing = 0.992;
      holdBreath = 0.08;
      focusCompression = 0.96;
      luminanceReduction = 0.03;
    } else {
      ambientDrift = 1 + norm * 0.002;
      environmentalPressure = norm * 0.012;
      workspaceBreathing = 1 + norm * 0.003;
      holdBreath = norm * 0.18;
      focusCompression = 0.94;
      luminanceReduction = norm * 0.02;
    }

    if (input.rvol >= 3.5 && !input.silenceActive) {
      holdBreath = Math.min(0.72, holdBreath + 0.08);
    }

    workspaceBreathing *= ambient / tight;
    focusCompression *= 2 - tight;

    return {
      ambientDrift: Math.max(0.96, Math.min(1.015, ambientDrift)),
      environmentalPressure: Math.max(-0.05, Math.min(0.12, environmentalPressure)),
      workspaceBreathing: Math.max(0.93, Math.min(1.015, workspaceBreathing)),
      holdBreath: Math.max(0, Math.min(0.85, holdBreath)),
      focusCompression: Math.max(0.82, Math.min(1, focusCompression)),
      luminanceReduction: Math.max(0, Math.min(0.06, luminanceReduction * 0.72))
    };
  }
}
