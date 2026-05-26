import { ActiveSignal, IntelligenceFields } from '../models/workspace.model';
import { TradingSignal } from '../models/signal.model';
import { TradingSymbol } from '../models/trading-symbol.model';
import { SIGNAL_HEALTH_META, SignalHealthInfo, SignalHealthState } from '../models/signal-health.model';

type HealthSource = Pick<ActiveSignal, 'signalType' | 'lifecycleState' | 'freshness' | 'confidenceScore' | 'extended'>
  & IntelligenceFields;

const BEARISH_TYPES = new Set([
  'OPEN_FAIL', 'OPEN_FAIL_BREAK', 'RECOVERY_FAIL', 'IMBALANCE_DOWN', 'EXIT'
]);

export function computeSignalHealth(source: HealthSource | null | undefined): SignalHealthInfo {
  if (!source) {
    return toInfo('BUILDING');
  }

  const lifecycle = source.lifecycleState?.toUpperCase();
  const freshness = source.freshness?.toUpperCase();
  const bearish = BEARISH_TYPES.has(source.signalType);

  if (lifecycle === 'INVALIDATED' || lifecycle === 'EXITED') {
    return toInfo(bearish ? 'FAILING' : 'WEAKENING');
  }
  if (lifecycle === 'WEAKENING') {
    return toInfo('WEAKENING');
  }
  if (source.extended && !bearish) {
    return toInfo('PEAKING');
  }
  if (freshness === 'STALE' || freshness === 'AGING') {
    return toInfo('WEAKENING');
  }
  if (freshness === 'FRESH' && (source.confidenceScore ?? 0) >= 5) {
    return toInfo('STRONG');
  }
  if (freshness === 'FRESH' || freshness === 'ACTIVE') {
    return toInfo(lifecycle === 'NEW' ? 'BUILDING' : 'STRONG');
  }
  return toInfo('BUILDING');
}

export function healthFromSymbol(item: TradingSymbol): SignalHealthInfo {
  return computeSignalHealth({
    signalType: item.signalState ?? '',
    lifecycleState: item.lifecycleState ?? undefined,
    freshness: item.freshness ?? undefined,
    confidenceScore: item.confidenceScore ?? undefined,
    extended: item.extended,
    rankScore: item.rankScore,
    mtfSummary: item.mtfSummary
  });
}

export function healthFromSignal(signal: TradingSignal): SignalHealthInfo {
  return computeSignalHealth(signal);
}

function toInfo(state: SignalHealthState): SignalHealthInfo {
  const meta = SIGNAL_HEALTH_META[state];
  return { state, label: meta.label, cssClass: meta.cssClass };
}
