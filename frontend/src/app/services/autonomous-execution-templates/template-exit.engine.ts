import { Injectable } from '@angular/core';
import { AutonomousTemplateContext, TemplateExitResult } from './autonomous-template.models';
import { RegimeTemplateDefinition } from './autonomous-template.models';
import { persistenceContinuationOverride } from './template-calibration.util';

@Injectable({ providedIn: 'root' })
export class TemplateExitEngine {
  compute(ctx: AutonomousTemplateContext, def: RegimeTemplateDefinition): TemplateExitResult {
    const { lifecycle, metrics, regime, probabilistic } = ctx;
    const exitState = probabilistic?.adaptiveExit?.state;
    const holdContinuation = persistenceContinuationOverride(metrics);

    if (regime === 'EXHAUSTION_DRIFT') {
      return {
        exitLabel: exitState ? formatExit(exitState) : 'EXIT PRIORITY',
        exhaustionPriority: true,
        trimBias: metrics.exhaustionProbability >= 55
      };
    }

    if (lifecycle === 'EXHAUSTING' && metrics.exhaustionProbability >= 58 && !holdContinuation) {
      return {
        exitLabel: exitState ? formatExit(exitState) : 'REDUCE ON EXHAUSTION',
        exhaustionPriority: true,
        trimBias: metrics.exhaustionProbability >= 68
      };
    }

    if (lifecycle === 'EXTENDED' || metrics.extended) {
      return {
        exitLabel: holdContinuation
          ? 'TRAIL CONTINUATION · HOLD PERSISTENCE'
          : 'TRAIL CONTINUATION · REDUCE ON STALL',
        exhaustionPriority: !holdContinuation && metrics.exhaustionProbability >= 58,
        trimBias: false
      };
    }

    if (
      regime === 'INSTITUTIONAL_PERSISTENCE'
      || regime === 'PERSISTENT_CONTINUATION'
      || regime === 'EARLY_EXPANSION'
      || regime === 'SHALLOW_PULLBACK_CONTINUATION'
    ) {
      return {
        exitLabel: exitState ? formatExit(exitState) : 'TRAILING CONTINUATION HOLD',
        exhaustionPriority: false,
        trimBias: false
      };
    }

    if (lifecycle === 'DEVELOPING' || lifecycle === 'CONFIRMING') {
      return {
        exitLabel: 'HOLD — AWAIT CONFIRMATION',
        exhaustionPriority: false,
        trimBias: false
      };
    }

    return {
      exitLabel: exitState ? formatExit(exitState) : 'HOLD',
      exhaustionPriority: metrics.exhaustionProbability >= 72 && !holdContinuation,
      trimBias: false
    };
  }
}

function formatExit(state: string): string {
  return state.replace(/_/g, ' ');
}
