import { Injectable } from '@angular/core';
import { IntensityMode } from './situational-intensity.engine';
import { CorridorBias } from './attention-gravity.service';

export interface PressureInput {
  intensityMode: IntensityMode;
  corridorBias: CorridorBias;
  silenceActive: boolean;
  holdBreath: number;
}

export interface PressureSnapshot {
  forwardPressure: number;
  contrastCompression: number;
  brightnessSteer: number;
  corridorNarrow: number;
}

@Injectable({ providedIn: 'root' })
export class ConvictionPressureEngine {
  resolve(input: PressureInput): PressureSnapshot {
    if (input.silenceActive || input.intensityMode === 'CHOP') {
      return {
        forwardPressure: 0,
        contrastCompression: 0.92,
        brightnessSteer: 1.02,
        corridorNarrow: 0.78
      };
    }

    if (input.intensityMode === 'FAILURE' || input.corridorBias === 'stop') {
      return {
        forwardPressure: -0.85 - input.holdBreath * 0.08,
        contrastCompression: 0.96 + input.holdBreath * 0.04,
        brightnessSteer: 1.02 - input.holdBreath * 0.02,
        corridorNarrow: 0.82 + input.holdBreath * 0.06
      };
    }

    if (input.intensityMode === 'BREAKOUT' || input.corridorBias === 'target') {
      return {
        forwardPressure: 0.78 + input.holdBreath * 0.06,
        contrastCompression: 1.02,
        brightnessSteer: 1.012,
        corridorNarrow: 0.88
      };
    }

    if (input.intensityMode === 'TRIGGER') {
      return {
        forwardPressure: 0.42,
        contrastCompression: 0.98,
        brightnessSteer: 1.004,
        corridorNarrow: 0.92
      };
    }

    return {
      forwardPressure: 0,
      contrastCompression: 0.96,
      brightnessSteer: 0.99,
      corridorNarrow: 1
    };
  }
}
