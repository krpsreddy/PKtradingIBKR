import { Injectable } from '@angular/core';
import { AutonomousTemplateContext, TemplateInvalidationResult, TemplateStopResult } from './autonomous-template.models';
import { RegimeTemplateDefinition } from './autonomous-template.models';

@Injectable({ providedIn: 'root' })
export class TemplateInvalidationEngine {
  compute(
    ctx: AutonomousTemplateContext,
    def: RegimeTemplateDefinition,
    stop: TemplateStopResult
  ): TemplateInvalidationResult {
    const { price, indicators, direction, metrics, lifecycle, regime } = ctx;
    const long = direction === 'LONG';
    const rules: string[] = [];

    if (regime === 'EXHAUSTION_DRIFT') {
      rules.push('No new entry — exhaustion drift');
      rules.push('Trim on persistence loss');
      return { level: round(stop.price), rules };
    }

    let level = stop.price;

    switch (regime) {
      case 'VWAP_ACCEPTANCE':
        level = long ? indicators.vwap * 0.993 : indicators.vwap * 1.007;
        rules.push('VWAP reclaim failure');
        break;
      case 'COMPRESSION_BREAKOUT':
        level = long ? stop.price * 0.998 : stop.price * 1.002;
        rules.push('Compression structure break');
        break;
      case 'HEALTHY_EXTENSION':
        level = long ? price * 0.992 : price * 1.008;
        rules.push('Extension invalidation — tighter');
        break;
      case 'EARLY_EXPANSION':
        level = long ? stop.price * 0.997 : stop.price * 1.003;
        rules.push('Momentum stall below stop band');
        break;
      default:
        level = long
          ? Math.min(stop.price, indicators.ema20 * 0.991)
          : Math.max(stop.price, indicators.ema20 * 1.009);
        rules.push('Structure + persistence invalidation');
    }

    if (metrics.exhaustionProbability >= 55) {
      rules.push(`Exhaustion ${metrics.exhaustionProbability}% — tighten invalidation`);
      level = long ? level * 1.002 : level * 0.998;
    }
    if (lifecycle === 'EXTENDED' || lifecycle === 'EXHAUSTING') {
      rules.push('Lifecycle extension — invalidation priority');
      level = long ? Math.max(level, price * 0.995) : Math.min(level, price * 1.005);
    }

    return { level: round(level), rules };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
