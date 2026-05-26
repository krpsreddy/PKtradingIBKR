import { Injectable } from '@angular/core';
import { IntensityMode } from './situational-intensity.engine';

export interface FailureHierarchyInput {
  intensityMode: IntensityMode;
  exitNow: boolean;
  exitLabel: string;
  failPct: number;
  dominantPath?: string;
}

export interface FailureHierarchySnapshot {
  exitDominant: boolean;
  stopSecondary: boolean;
  entrySuppressed: boolean;
  rrSuppressed: boolean;
  exitOpacity: number;
  exitWeight: number;
  stopLuminanceScale: number;
  cssVars: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class FailurePriorityHierarchyEngine {
  resolve(input: FailureHierarchyInput): FailureHierarchySnapshot {
    const exitNow = input.exitNow
      || input.exitLabel.toUpperCase().includes('EXIT');
    const failureMode = input.intensityMode === 'FAILURE'
      || input.failPct >= 30
      || input.dominantPath === 'exit';
    const exitDominant = failureMode && exitNow;

    if (!exitDominant) {
      return {
        exitDominant: false,
        stopSecondary: false,
        entrySuppressed: false,
        rrSuppressed: false,
        exitOpacity: 1,
        exitWeight: 700,
        stopLuminanceScale: 1,
        cssVars: {}
      };
    }

    return {
      exitDominant: true,
      stopSecondary: true,
      entrySuppressed: true,
      rrSuppressed: true,
      exitOpacity: 0.96,
      exitWeight: 800,
      stopLuminanceScale: 1.08,
      cssVars: {
        '--failure-exit-opacity': '0.96',
        '--failure-stop-luminance': '1.08',
        '--failure-exit-weight': '800'
      }
    };
  }
}
