import { SetupCandidate, SetupDeterioration, DeteriorationState } from '../models/execution.model';
import { IndicatorSnapshot } from '../models/indicator.model';
import { TradingSymbol } from '../models/trading-symbol.model';

export function detectSetupDeterioration(
  source: SetupCandidate | null | undefined,
  symbol: TradingSymbol | null | undefined,
  indicators: IndicatorSnapshot | null | undefined,
  price: number | null | undefined
): SetupDeterioration {
  const reasons: string[] = [];
  if (!source) {
    return { state: 'STABLE', reasons: [] };
  }

  let severity = 0;

  if (source.freshness === 'STALE') { reasons.push('Signal stale'); severity += 2; }
  if (source.freshness === 'AGING') { reasons.push('Freshness decay'); severity += 1; }
  if (source.lifecycleState === 'WEAKENING') { reasons.push('Lifecycle weakening'); severity += 2; }
  if (source.lifecycleState === 'INVALIDATED') { reasons.push('Setup invalidated'); severity += 3; }

  const rvol = source.relativeVolume ?? symbol?.relativeVolume ?? indicators?.relativeVolume ?? 0;
  if (rvol > 0 && rvol < 1.2) { reasons.push('Weakening RVOL'); severity += 1; }

  if (indicators && price != null) {
    if (price < indicators.vwap && isBullish(source.signalType)) {
      reasons.push('Lost VWAP'); severity += 2;
    }
    if (indicators.macd < indicators.signalLine) {
      reasons.push('MACD weakening'); severity += 1;
    }
    if (indicators.rsi < 45 && isBullish(source.signalType)) {
      reasons.push('RSI fading'); severity += 1;
    }
  }

  if (source.extended) { reasons.push('Extended move'); severity += 1; }

  let state: DeteriorationState = 'STABLE';
  if (severity >= 4) state = 'FAILING';
  else if (severity >= 2) state = 'WEAKENING';

  return { state, reasons: [...new Set(reasons)] };
}

function isBullish(type: string): boolean {
  return !type.includes('FAIL') && type !== 'IMBALANCE_DOWN' && type !== 'EXIT';
}
