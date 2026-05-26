import { MarketTrend } from '../../models/workspace.model';
import { MarketAttentionMode } from './dominant-opportunity.models';
import { isUsMarketOpen } from '../../utils/market-session.util';

/** Adapt dominance weights to session / regime context. */
export function resolveMarketAttentionMode(trend: MarketTrend | null | undefined): MarketAttentionMode {
  if (!trend) return 'NEUTRAL';

  const regime = (trend.regime ?? '').toUpperCase();
  const choppy = !!trend.choppy;
  const riskOn = trend.riskOn !== false;

  if (regime.includes('EXHAUST') || regime.includes('FADE')) return 'EXHAUSTION_DAY';
  if (choppy || regime.includes('CHOP') || regime.includes('RANGE')) return 'CHOP_DAY';
  if (!riskOn && (trend.riskOnScore ?? 50) < 40) return 'LOW_PARTICIPATION';

  const etHour = easternHour();
  if (etHour >= 9 && etHour < 10) return 'OPENING_DRIVE';
  if (etHour >= 13 && etHour < 16 && isUsMarketOpen()) return 'AFTERNOON_CONTINUATION';
  if (trend.marketAligned && !choppy) return 'TREND_DAY';

  return 'NEUTRAL';
}

/** Multiplier applied to dominance components by market mode. */
export function marketModeWeights(mode: MarketAttentionMode): {
  velocity: number;
  persistence: number;
  institutional: number;
  execution: number;
  dominanceFloor: number;
} {
  switch (mode) {
    case 'TREND_DAY':
      return { velocity: 1.15, persistence: 1.1, institutional: 1.05, execution: 1, dominanceFloor: 58 };
    case 'OPENING_DRIVE':
      return { velocity: 1.25, persistence: 0.9, institutional: 1.1, execution: 1.05, dominanceFloor: 55 };
    case 'AFTERNOON_CONTINUATION':
      return { velocity: 0.95, persistence: 1.2, institutional: 1.15, execution: 1, dominanceFloor: 60 };
    case 'CHOP_DAY':
      return { velocity: 0.85, persistence: 1.05, institutional: 0.9, execution: 1.1, dominanceFloor: 68 };
    case 'EXHAUSTION_DAY':
      return { velocity: 0.7, persistence: 0.85, institutional: 0.8, execution: 1.15, dominanceFloor: 72 };
    case 'LOW_PARTICIPATION':
      return { velocity: 0.75, persistence: 1, institutional: 0.85, execution: 1, dominanceFloor: 70 };
    default:
      return { velocity: 1, persistence: 1, institutional: 1, execution: 1, dominanceFloor: 62 };
  }
}

function easternHour(): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false
  });
  return parseInt(fmt.format(new Date()), 10) || 12;
}
