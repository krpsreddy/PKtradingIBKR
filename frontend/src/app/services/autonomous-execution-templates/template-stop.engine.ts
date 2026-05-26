import { Injectable } from '@angular/core';
import { AutonomousTemplateContext, TemplateEntryResult, TemplateStopResult } from './autonomous-template.models';
import { RegimeTemplateDefinition } from './autonomous-template.models';
import { lifecycleStopTightness } from './template-lifecycle.util';

@Injectable({ providedIn: 'root' })
export class TemplateStopEngine {
  compute(
    ctx: AutonomousTemplateContext,
    def: RegimeTemplateDefinition,
    entry: TemplateEntryResult
  ): TemplateStopResult {
    const { price, indicators, direction, metrics, lifecycle, regime } = ctx;
    const long = direction === 'LONG';
    const life = lifecycleStopTightness(lifecycle);
    const volPct = def.stopWidthPct * life * volatilityScale(metrics.relativeVolume, metrics.extended);

    if (regime === 'EXHAUSTION_DRIFT') {
      const trim = long ? price * 0.997 : price * 1.003;
      return { price: round(trim), style: 'Trim bias stop', volatilityAdjusted: true };
    }

    switch (regime) {
      case 'EARLY_EXPANSION':
        return {
          price: round(long ? price * (1 - volPct * 1.35) : price * (1 + volPct * 1.35)),
          style: 'Wider momentum stop',
          volatilityAdjusted: true
        };
      case 'VWAP_ACCEPTANCE':
        return {
          price: round(long ? indicators.vwap * 0.996 : indicators.vwap * 1.004),
          style: 'VWAP loss stop',
          volatilityAdjusted: false
        };
      case 'SHALLOW_PULLBACK_CONTINUATION':
        return {
          price: round(long ? Math.min(entry.low, indicators.ema20) * 0.994 : Math.max(entry.high, indicators.ema20) * 1.006),
          style: 'Structure stop under PB',
          volatilityAdjusted: false
        };
      case 'COMPRESSION_BREAKOUT':
        return {
          price: round(long ? entry.low * 0.997 : entry.high * 1.003),
          style: 'Compression floor stop',
          volatilityAdjusted: false
        };
      case 'HEALTHY_EXTENSION':
        return {
          price: round(long ? price * (1 - volPct * 0.75) : price * (1 + volPct * 0.75)),
          style: 'Tighter extension stop',
          volatilityAdjusted: true
        };
      case 'INSTITUTIONAL_PERSISTENCE':
      case 'PERSISTENT_CONTINUATION':
        return {
          price: round(long
            ? Math.min(indicators.ema20, indicators.vwap) * (1 - volPct * 0.6)
            : Math.max(indicators.ema20, indicators.vwap) * (1 + volPct * 0.6)),
          style: 'Persistence structure stop',
          volatilityAdjusted: metrics.continuationPersistence > 65
        };
      default:
        return {
          price: round(long ? price * (1 - volPct) : price * (1 + volPct)),
          style: def.stopStyle,
          volatilityAdjusted: true
        };
    }
  }
}

function volatilityScale(rvol: number, extended: boolean): number {
  let s = 1;
  if (rvol >= 2) s *= 1.15;
  else if (rvol < 1) s *= 0.9;
  if (extended) s *= 0.92;
  return s;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
