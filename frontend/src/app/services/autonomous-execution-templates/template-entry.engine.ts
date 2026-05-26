import { Injectable } from '@angular/core';
import { AutonomousTemplateContext, TemplateEntryResult } from './autonomous-template.models';
import { RegimeTemplateDefinition } from './autonomous-template.models';
import { lifecycleEntryTightness } from './template-lifecycle.util';

@Injectable({ providedIn: 'root' })
export class TemplateEntryEngine {
  compute(ctx: AutonomousTemplateContext, def: RegimeTemplateDefinition): TemplateEntryResult {
    const { price, indicators, direction, metrics, lifecycle, regime } = ctx;
    const long = direction === 'LONG';
    const tight = lifecycleEntryTightness(lifecycle);
    const vwap = indicators.vwap;
    const ema9 = indicators.ema9;
    const ema20 = indicators.ema20;
    const agg = def.entryAggression * tight;

    if (!def.allowsEntry || regime === 'EXHAUSTION_DRIFT') {
      return {
        low: price,
        high: price,
        ideal: price,
        style: 'No-entry · trim bias',
        aggressive: false
      };
    }

    switch (regime) {
      case 'EARLY_EXPANSION': {
        const band = price * 0.004 * agg;
        return {
          low: round(long ? price - band * 0.5 : price + band * 0.5),
          high: round(long ? price + band * 1.2 : price - band * 1.2),
          ideal: round(long ? price + band * 0.35 : price - band * 0.35),
          style: 'Aggressive momentum entry',
          aggressive: true
        };
      }
      case 'INSTITUTIONAL_PERSISTENCE':
      case 'PERSISTENT_CONTINUATION': {
        const anchor = long ? Math.max(ema9, vwap) : Math.min(ema9, vwap);
        const pb = price * 0.003 * (2 - agg);
        return {
          low: round(long ? anchor - pb : anchor + pb),
          high: round(long ? price + pb * 0.6 : price - pb * 0.6),
          ideal: round(long ? anchor + pb * 0.15 : anchor - pb * 0.15),
          style: 'Shallow PB / persistence hold',
          aggressive: false
        };
      }
      case 'VWAP_ACCEPTANCE': {
        const reclaim = vwap;
        const band = price * 0.0025;
        return {
          low: round(long ? reclaim - band : reclaim + band),
          high: round(long ? price + band : price - band),
          ideal: round(reclaim),
          style: 'VWAP reclaim entry',
          aggressive: false
        };
      }
      case 'SHALLOW_PULLBACK_CONTINUATION': {
        const mid = long ? (ema9 + ema20) / 2 : (ema9 + ema20) / 2;
        const w = price * 0.0035;
        return {
          low: round(long ? mid - w : mid + w),
          high: round(long ? price : price),
          ideal: round(long ? mid : mid),
          style: 'Pullback zone entry',
          aggressive: false
        };
      }
      case 'COMPRESSION_BREAKOUT': {
        const trigger = long ? price * 1.0015 : price * 0.9985;
        const floor = long ? price * 0.996 : price * 1.004;
        return {
          low: round(floor),
          high: round(long ? trigger * 1.004 : trigger * 0.996),
          ideal: round(trigger),
          style: 'Breakout trigger',
          aggressive: true
        };
      }
      case 'HEALTHY_EXTENSION': {
        const band = price * 0.002 * agg;
        return {
          low: round(long ? price - band : price + band),
          high: round(long ? price + band * 0.5 : price - band * 0.5),
          ideal: round(price),
          style: 'Reduced-size continuation',
          aggressive: false
        };
      }
      default:
        return {
          low: round(long ? price * 0.998 : price * 1.002),
          high: round(long ? price * 1.003 : price * 0.997),
          ideal: round(price),
          style: def.entryStyle,
          aggressive: false
        };
    }
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
