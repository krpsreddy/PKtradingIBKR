import { Injectable } from '@angular/core';

export interface OverlayIntelContext {
  adaptiveExit: string | null;
  deterioration: string | null;
  failurePct: number | null;
  continuationRising: boolean;
  exitNow: boolean;
  labelSharpness?: number;
  breakoutMode?: boolean;
}

export interface LevelEmphasis {
  opacity: number;
  lineWidth: number;
  pulse: boolean;
  visible: boolean;
  axisBright: number;
  lineColor: string | null;
}

const DEFAULT: LevelEmphasis = {
  opacity: 0.45,
  lineWidth: 1,
  pulse: false,
  visible: true,
  axisBright: 0.5,
  lineColor: null
};

@Injectable({ providedIn: 'root' })
export class ExecutionOverlayIntelligenceService {
  emphasize(ctx: OverlayIntelContext): Record<string, LevelEmphasis> {
    const sharp = ctx.labelSharpness ?? 0.7;
    const weakening = ctx.deterioration === 'WEAKENING' || ctx.deterioration === 'FAILING'
      || (ctx.failurePct ?? 0) >= 30;
    const exitNow = ctx.exitNow || ctx.adaptiveExit?.includes('EXIT') === true;
    const cont = (ctx.continuationRising || ctx.breakoutMode) && !weakening;

    const stop: LevelEmphasis = {
      opacity: exitNow ? 1 : weakening ? 0.92 : 0.72,
      lineWidth: exitNow ? 2 : weakening ? 1.5 : 1,
      pulse: exitNow,
      visible: true,
      axisBright: exitNow ? 1 : weakening ? 0.9 : 0.75,
      lineColor: exitNow ? '#ff7b72' : '#f8514966'
    };

    const entry: LevelEmphasis = {
      opacity: cont ? 0.98 : exitNow ? 0.45 : 0.78,
      lineWidth: cont ? 1.5 : 1,
      pulse: false,
      visible: !exitNow || !!cont,
      axisBright: cont ? 0.95 : exitNow ? 0.4 : 0.82,
      lineColor: cont ? '#3fb950' : '#3fb95088'
    };

    const target: LevelEmphasis = {
      opacity: exitNow ? 0.22 : weakening ? 0.28 : cont ? 0.82 : 0.48,
      lineWidth: 1,
      pulse: false,
      visible: !exitNow,
      axisBright: cont ? 0.72 : exitNow ? 0.2 : 0.45,
      lineColor: cont ? '#a371f788' : '#8b949e44'
    };

    const trigger: LevelEmphasis = {
      opacity: cont ? 0.92 * sharp : 0.58,
      lineWidth: cont ? 1.5 : 1,
      pulse: !!cont,
      visible: true,
      axisBright: cont ? 0.88 : 0.55,
      lineColor: '#d2aa5a88'
    };

    const prev: LevelEmphasis = {
      opacity: 0.32,
      lineWidth: 1,
      pulse: false,
      visible: !exitNow,
      axisBright: 0.35,
      lineColor: '#484f5844'
    };

    return {
      Entry: entry,
      'Entry+': { ...entry, opacity: entry.opacity * 0.88, axisBright: entry.axisBright * 0.9 },
      Stop: stop,
      Invalid: { ...stop, opacity: stop.opacity * 0.85, axisBright: stop.axisBright * 0.88, lineColor: '#f8514966' },
      Target: target,
      Trigger: trigger,
      Prev: prev
    };
  }

  get(label: string, map: Record<string, LevelEmphasis>): LevelEmphasis {
    return map[label] ?? DEFAULT;
  }
}
