import {
  ChartExecutionLevel,
  EntryQuality,
  ExecutionGuidance,
  OptionsDirection,
  SetupCandidate
} from '../models/execution.model';
import { IndicatorSnapshot } from '../models/indicator.model';

const BEARISH = new Set(['OPEN_FAIL', 'OPEN_FAIL_BREAK', 'RECOVERY_FAIL', 'IMBALANCE_DOWN']);

export function buildExecutionGuidance(
  source: SetupCandidate | null | undefined,
  price: number | null | undefined,
  indicators: IndicatorSnapshot | null | undefined
): ExecutionGuidance | null {
  if (!source || price == null || !indicators) return null;

  const entryQuality = computeEntryQuality(source, price, indicators);
  const bullish = !BEARISH.has(source.signalType);
  const direction: OptionsDirection = bullish ? 'CALLS' : BEARISH.has(source.signalType) ? 'PUTS' : 'NONE';

  const stopZone = bullish
    ? Math.min(indicators.vwap, indicators.ema9) * 0.995
    : Math.max(indicators.vwap, indicators.ema9) * 1.005;
  const invalidation = bullish
    ? Math.min(indicators.ema20, indicators.vwap) * 0.992
    : Math.max(indicators.ema20, indicators.vwap) * 1.008;

  const target = bullish ? price * 1.015 : price * 0.985;
  const risk = Math.abs(price - invalidation);
  const reward = Math.abs(target - price);
  const estimatedRr = risk > 0 ? Math.round((reward / risk) * 10) / 10 : null;

  const warnings: string[] = [...(source.optionsWarnings ?? [])];
  if (entryQuality === 'LATE' || entryQuality === 'CHASING') warnings.push('Late entry risk');
  if (source.extended) warnings.push('EXTENDED move');
  if (entryQuality === 'CHASING') warnings.push('Theta risk elevated');

  let optionsRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (entryQuality === 'CHASING' || source.extended) optionsRiskLevel = 'HIGH';
  else if (entryQuality === 'LATE' || source.freshness === 'AGING') optionsRiskLevel = 'MEDIUM';

  const tradeQuality = computeTradeQuality(entryQuality, source, indicators);

  return {
    entryQuality,
    tradeQuality,
    suggestedDirection: direction,
    optionStyle: direction === 'CALLS'
      ? 'ATM / slightly ITM · Delta 0.60+ · Avoid chasing'
      : direction === 'PUTS'
        ? 'ATM PUT · Avoid low liquidity spreads'
        : '—',
    stopZone: round2(stopZone),
    invalidationLevel: round2(invalidation),
    estimatedRr,
    optionsRiskLevel,
    warnings: [...new Set(warnings)],
    entryZoneLow: round2(bullish ? price * 0.998 : price * 1.002),
    entryZoneHigh: round2(bullish ? price * 1.003 : price * 0.997)
  };
}

export function buildChartLevels(
  guidance: ExecutionGuidance | null,
  price: number | null | undefined,
  extended: boolean,
  snapshot?: { targetPrice?: number | null; stopZone?: number | null } | null
): ChartExecutionLevel[] {
  if (!guidance || price == null) return [];
  const levels: ChartExecutionLevel[] = [];
  if (guidance.entryZoneLow != null) {
    levels.push({ price: guidance.entryZoneLow, label: 'Entry', color: '#22c55e88', lineStyle: 2, zone: 'entry' });
  }
  if (guidance.entryZoneHigh != null && guidance.entryZoneHigh !== guidance.entryZoneLow) {
    levels.push({ price: guidance.entryZoneHigh, label: 'Entry+', color: '#22c55e55', lineStyle: 2, zone: 'entry' });
  }
  const stop = snapshot?.stopZone ?? guidance.stopZone;
  if (stop != null) {
    levels.push({ price: stop, label: 'Stop', color: '#ef535088', lineStyle: 2, zone: 'stop' });
  }
  if (guidance.invalidationLevel != null) {
    levels.push({ price: guidance.invalidationLevel, label: 'Invalid', color: '#ef5350', lineStyle: 0, zone: 'invalid' });
  }
  const target = snapshot?.targetPrice ?? (guidance.estimatedRr && guidance.invalidationLevel
    ? price + (price - guidance.invalidationLevel) * guidance.estimatedRr : null);
  if (target != null) {
    levels.push({ price: target, label: 'Target', color: '#a371f788', lineStyle: 2, zone: 'target' });
  }
  if (extended && price) {
    levels.push({ price: price * 1.02, label: 'EXT', color: '#bc8cff', lineStyle: 1 });
  }
  return levels;
}

export function computeEntryQuality(
  source: SetupCandidate,
  price: number,
  indicators: IndicatorSnapshot
): EntryQuality {
  if (source.extended) return 'CHASING';
  if (source.freshness === 'STALE') return 'LATE';

  const ema9Dist = Math.abs(price - indicators.ema9) / price;
  const vwapDist = Math.abs(price - indicators.vwap) / price;

  if (source.freshness === 'FRESH' && ema9Dist < 0.008 && vwapDist < 0.01) return 'EARLY';
  if (source.freshness === 'FRESH' || source.freshness === 'ACTIVE') {
    if (ema9Dist > 0.035 || vwapDist > 0.04) return 'CHASING';
    if (ema9Dist > 0.02 || vwapDist > 0.025) return 'LATE';
    return 'GOOD';
  }
  if (ema9Dist > 0.025) return 'LATE';
  return 'GOOD';
}

function computeTradeQuality(
  entryQuality: EntryQuality,
  source: SetupCandidate,
  indicators: IndicatorSnapshot
): number {
  let q = source.rankScore ?? 50;
  if (entryQuality === 'EARLY') q += 15;
  if (entryQuality === 'GOOD') q += 8;
  if (entryQuality === 'LATE') q -= 15;
  if (entryQuality === 'CHASING') q -= 25;
  if (indicators.relativeVolume >= 2) q += 5;
  if (source.mtfSummary?.toLowerCase().includes('bullish')) q += 5;
  return Math.max(0, Math.min(100, Math.round(q)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
