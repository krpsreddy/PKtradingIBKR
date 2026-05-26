import { ActiveSignal, IntelligenceFields } from '../models/workspace.model';
import { TradingSignal } from '../models/signal.model';
import { TradingSymbol } from '../models/trading-symbol.model';
import { IndicatorSnapshot } from '../models/indicator.model';

export interface SignalConditions {
  passed: string[];
  failed: string[];
  optionsWarnings: string[];
}

type ConditionSource = Pick<TradingSignal, 'signalReasons' | 'signalReason' | 'relativeVolume' | 'confidenceLabel'>
  & IntelligenceFields
  & Partial<Pick<ActiveSignal, 'trend'>>;

export function buildSignalConditions(
  source: ConditionSource | null | undefined,
  symbol?: TradingSymbol | null,
  indicators?: IndicatorSnapshot | null
): SignalConditions {
  const passed: string[] = [];
  const failed: string[] = [];
  const optionsWarnings: string[] = [...(source?.optionsWarnings ?? [])];

  if (source?.signalReasons?.length) {
    passed.push(...source.signalReasons);
  } else if (source?.signalReason) {
    passed.push(source.signalReason);
  }

  if (source?.relativeVolume != null && source.relativeVolume >= 1.5) {
    if (!passed.some(p => p.toLowerCase().includes('rvol'))) {
      passed.push(`RVOL ${source.relativeVolume.toFixed(1)}x`);
    }
  }

  if (source?.mtfSummary) {
    const mtf = source.mtfSummary.toLowerCase();
    if (mtf.includes('bullish')) {
      passed.push(`MTF aligned (${source.mtfSummary})`);
    } else if (mtf.includes('bearish')) {
      failed.push(`MTF opposing (${source.mtfSummary})`);
    }
  }

  if (symbol?.regimeAligned) {
    passed.push('Market regime aligned');
  } else if (symbol && symbol.regimeAligned === false) {
    failed.push('Weak market regime');
  }

  if (indicators && indicators.vwap > 0) {
    // inferred from trend label context when available
  }

  if (source?.extended) {
    failed.push('EXTENDED move');
    if (!optionsWarnings.includes('Late options entry risk')) {
      optionsWarnings.push('Late options entry risk');
    }
  }

  if (source?.freshness === 'STALE' || source?.freshness === 'AGING') {
    failed.push(`${source.freshness === 'STALE' ? 'Stale' : 'Aging'} signal`);
    if (source.freshness === 'STALE' && !optionsWarnings.includes('Signal stale for options')) {
      optionsWarnings.push('Signal stale for options');
    }
  }

  if (source?.confidenceLabel) {
    passed.push(`Confidence: ${source.confidenceLabel}`);
  }

  return {
    passed: dedupe(passed),
    failed: dedupe(failed),
    optionsWarnings: dedupe(optionsWarnings)
  };
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
