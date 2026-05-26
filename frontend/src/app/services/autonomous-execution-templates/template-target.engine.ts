import { Injectable } from '@angular/core';
import {
  AutonomousTemplateContext,
  TemplateEntryResult,
  TemplateStopResult,
  TemplateTargetResult
} from './autonomous-template.models';
import { RegimeTemplateDefinition } from './autonomous-template.models';
import {
  exhaustionShrinkFactor,
  lifecycleTargetScaleCalibrated,
  persistenceContinuationOverride,
  regimeTargetBoost,
  rvolSustainmentMult
} from './template-calibration.util';

/** Adaptive targets — Phase 177 calibrated for continuation / MFE capture. */
@Injectable({ providedIn: 'root' })
export class TemplateTargetEngine {
  compute(
    ctx: AutonomousTemplateContext,
    def: RegimeTemplateDefinition,
    entry: TemplateEntryResult,
    stop: TemplateStopResult
  ): TemplateTargetResult {
    const { price, direction, metrics, lifecycle, regime } = ctx;
    const long = direction === 'LONG';
    const risk = Math.max(0.01, Math.abs((entry.ideal ?? price) - stop.price));

    if (regime === 'EXHAUSTION_DRIFT' || !def.allowsEntry) {
      return {
        primary: round(price),
        trailing: false,
        projectionLabel: 'De-risk / exit priority',
        adaptiveMultiple: 0
      };
    }

    const persistenceMult = 0.88 + (metrics.continuationPersistence / 100) * 0.82;
    const accelMult = 0.92 + (ctx.accelerationIntegrity / 100) * 0.52;
    const exhaustShrink = exhaustionShrinkFactor(metrics);
    const velocityMult = 1 + Math.min(0.48, metrics.expansionProbability / 240);
    const rvolMult = rvolSustainmentMult(metrics.relativeVolume);
    const narrativeMult = 1 + ctx.narrativeStrength * 0.24;
    const lifeScale = lifecycleTargetScaleCalibrated(lifecycle, metrics);
    const regimeBoost = regimeTargetBoost(regime);
    const secondLegBoost = persistenceContinuationOverride(metrics) ? 1.08 : 1;

    const adaptiveMultiple = Math.round(
      def.baseRewardMultiple
      * persistenceMult
      * accelMult
      * exhaustShrink
      * velocityMult
      * rvolMult
      * narrativeMult
      * lifeScale
      * regimeBoost
      * secondLegBoost
      * 10
    ) / 10;

    const reward = risk * adaptiveMultiple;
    const primary = round(long ? price + reward : price - reward);

    let secondary: number | undefined;
    const secondExt = persistenceContinuationOverride(metrics) ? 0.55 : 0.4;
    if (regime === 'COMPRESSION_BREAKOUT') {
      const range = Math.abs(entry.high - entry.low) || price * 0.008;
      secondary = round(long ? primary + range * 0.75 : primary - range * 0.75);
    } else if (
      regime === 'INSTITUTIONAL_PERSISTENCE'
      || regime === 'PERSISTENT_CONTINUATION'
      || regime === 'EARLY_EXPANSION'
      || regime === 'SHALLOW_PULLBACK_CONTINUATION'
    ) {
      secondary = round(long ? primary + reward * secondExt : primary - reward * secondExt);
    }

    const trailing = regime === 'INSTITUTIONAL_PERSISTENCE'
      || regime === 'PERSISTENT_CONTINUATION'
      || regime === 'EARLY_EXPANSION'
      || regime === 'SHALLOW_PULLBACK_CONTINUATION'
      || lifecycle === 'CONFIRMED'
      || lifecycle === 'EXTENDED'
      || persistenceContinuationOverride(metrics);

    return {
      primary,
      secondary,
      trailing,
      projectionLabel: `${adaptiveMultiple}× cal (persist ${Math.round(metrics.continuationPersistence)}% · rvol ${metrics.relativeVolume.toFixed(1)}x)`,
      adaptiveMultiple
    };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
