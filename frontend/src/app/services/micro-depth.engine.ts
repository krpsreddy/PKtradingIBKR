import { Injectable } from '@angular/core';
import { HISTORY_OPACITY_FLOOR, LIVE_CANDLE_OPACITY } from '../utils/chart-atmosphere-recovery.util';
import { IntensityMode } from './situational-intensity.engine';
import { CorridorBias } from './attention-gravity.service';

export interface DepthInput {
  intensityMode: IntensityMode;
  tensionScore: number;
  silenceActive: boolean;
  corridorBias: CorridorBias;
  maDepth: number;
  historyFade: number;
  candleEmphasis: number;
  liveCandleDominance: number;
}

export interface DepthSnapshot {
  liveCandle: number;
  overlays: number;
  labels: number;
  movingAverages: number;
  history: number;
  grid: number;
}

@Injectable({ providedIn: 'root' })
export class MicroDepthEngine {
  resolve(input: DepthInput): DepthSnapshot {
    const norm = Math.min(1, input.tensionScore / 100);
    const lift = input.corridorBias === 'target' ? 0.08 : input.corridorBias === 'stop' ? -0.04 : 0;
    const silence = input.silenceActive ? 0.85 : 1;

    const live = Math.min(LIVE_CANDLE_OPACITY, Math.max(0.92, (0.55 + input.liveCandleDominance * 0.45 + lift) * silence));
    const overlays = Math.min(1, (0.48 + norm * 0.22 + lift * 0.5) * silence);
    const labels = Math.min(1, (0.52 + norm * 0.28) * silence);
    const ma = Math.max(0.22, input.maDepth * (input.silenceActive ? 0.82 : 1));
    const history = Math.max(HISTORY_OPACITY_FLOOR, input.historyFade * silence);
    const grid = input.silenceActive ? 0.55 : 0.72 + norm * 0.1;

    if (input.intensityMode === 'BREAKOUT' || input.intensityMode === 'TRIGGER') {
      return {
        liveCandle: Math.min(1, live + 0.06),
        overlays: Math.min(1, overlays + 0.05),
        labels: Math.min(1, labels + 0.04),
        movingAverages: ma,
        history,
        grid: grid * 0.92
      };
    }

    if (input.intensityMode === 'FAILURE') {
      return {
        liveCandle: live * 0.92,
        overlays: overlays * 0.88,
        labels: Math.min(1, labels + 0.08),
        movingAverages: ma * 0.9,
        history: history * 1.05,
        grid: grid * 0.88
      };
    }

    return {
      liveCandle: live * input.candleEmphasis,
      overlays,
      labels,
      movingAverages: ma,
      history,
      grid
    };
  }
}
