import { Injectable } from '@angular/core';
import { IntensityMode } from './situational-intensity.engine';

export interface CognitionBreathingInput {
  pillCount: number;
  intensityMode: IntensityMode;
  urgency: boolean;
  tensionScore: number;
  zoomedOut: boolean;
  silenceActive: boolean;
}

export interface CognitionBreathingSnapshot {
  gapPx: number;
  maxVisible: number;
  inactiveMultiplier: number;
}

const MIN_GAP = 8;

@Injectable({ providedIn: 'root' })
export class CognitionBreathingEngine {
  resolve(input: CognitionBreathingInput): CognitionBreathingSnapshot {
    const count = Math.max(1, input.pillCount);
    const tension = Math.min(1, input.tensionScore / 100);
    let gapPx = 14;
    let maxVisible = 3;
    let inactiveMultiplier = 1;

    switch (input.intensityMode) {
      case 'CALM':
        gapPx = 16 - Math.min(4, count - 1);
        break;
      case 'FAILURE':
        gapPx = 10 - tension * 2;
        maxVisible = Math.min(3, count);
        break;
      case 'BREAKOUT':
      case 'TRIGGER':
        gapPx = 11 - tension * 2.5;
        maxVisible = Math.min(3, count);
        break;
      case 'CHOP':
        gapPx = 14 - Math.min(2, count - 1);
        inactiveMultiplier = input.silenceActive ? 0.42 : 0.52;
        maxVisible = count > 2 ? 2 : count;
        break;
      default:
        gapPx = 13 - Math.min(3, count - 1) * 0.5;
        break;
    }

    if (input.urgency && input.intensityMode !== 'CALM' && input.intensityMode !== 'CHOP') {
      gapPx = Math.max(MIN_GAP, gapPx - 1);
    }

    if (input.zoomedOut) {
      gapPx = Math.max(MIN_GAP, gapPx + 2);
      maxVisible = Math.min(maxVisible, 2);
    }

    gapPx = Math.max(MIN_GAP, Math.round(gapPx / 2) * 2);

    return {
      gapPx,
      maxVisible: Math.max(1, maxVisible),
      inactiveMultiplier: Math.max(0.38, Math.min(1, inactiveMultiplier))
    };
  }
}
