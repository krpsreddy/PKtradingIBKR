import { Injectable } from '@angular/core';
import { IntensityMode } from './situational-intensity.engine';

export type PriorityPath = 'none' | 'risk' | 'entry' | 'target' | 'exit';
export type MetricKey = 'exit' | 'stop' | 'entry' | 'rr';

export interface PriorityInput {
  intensityMode: IntensityMode;
  exitNow: boolean;
  silenceActive: boolean;
  failPct: number;
}

export interface PrioritySnapshot {
  dominantPath: PriorityPath;
  metricOrder: MetricKey[];
  spatialPull: number;
  railPrecision: number;
  stillness: boolean;
}

@Injectable({ providedIn: 'root' })
export class ExecutionPriorityMatrixService {
  resolve(input: PriorityInput): PrioritySnapshot {
    if (input.silenceActive || input.intensityMode === 'CHOP' || input.intensityMode === 'CALM') {
      return {
        dominantPath: input.intensityMode === 'CHOP' ? 'risk' : 'none',
        metricOrder: ['entry', 'stop', 'exit', 'rr'],
        spatialPull: 0.38,
        railPrecision: 0.52,
        stillness: true
      };
    }

    if (input.exitNow || input.intensityMode === 'FAILURE' || input.failPct >= 30) {
      return {
        dominantPath: 'exit',
        metricOrder: ['exit', 'stop', 'entry', 'rr'],
        spatialPull: 0.92,
        railPrecision: 0.96,
        stillness: true
      };
    }

    if (input.intensityMode === 'BREAKOUT') {
      return {
        dominantPath: 'target',
        metricOrder: ['entry', 'rr', 'stop', 'exit'],
        spatialPull: 0.88,
        railPrecision: 0.94,
        stillness: true
      };
    }

    if (input.intensityMode === 'TRIGGER') {
      return {
        dominantPath: 'entry',
        metricOrder: ['entry', 'stop', 'rr', 'exit'],
        spatialPull: 0.82,
        railPrecision: 0.9,
        stillness: true
      };
    }

    return {
      dominantPath: 'none',
      metricOrder: ['entry', 'stop', 'exit', 'rr'],
      spatialPull: 0.55,
      railPrecision: 0.72,
      stillness: true
    };
  }
}
