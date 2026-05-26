import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { LiveExecutionContext, OpenType, OpenTypeAnalyticsCell, OpenTypeSnapshot } from './live-execution.models';
import { extensionPctFromContext, normalizeSetup } from './live-execution-context.util';

const OPEN_WINDOW_MIN = 15;

/** Classifies first 15m session structure for live execution filtering. */
export class OpenTypeClassificationEngine {

  classifyLive(ctx: LiveExecutionContext): OpenTypeSnapshot {
    const mins = ctx.sessionTimeMinutes ?? 999;
    const ext = extensionPctFromContext(ctx);
    const rvol = ctx.rvol ?? 1;
    const regime = (ctx.marketRegime ?? '').toUpperCase();
    const setup = normalizeSetup(ctx.signalType);
    const vwapDist = ctx.vwapDistance ?? 0;

    let openType: OpenType = 'INSIDE_OPEN';

    if (mins >= OPEN_WINDOW_MIN) {
      openType = regime.includes('TREND') ? 'TREND_OPEN' : 'INSIDE_OPEN';
    } else if (ext >= 5 && rvol >= 2.5 && vwapDist > 0) {
      openType = 'GAP_AND_GO';
    } else if (ext >= 3 && vwapDist < -0.01 && rvol >= 2) {
      openType = 'OPENING_FLUSH';
    } else if (setup === 'VWAP_PERSISTENCE' || (ctx.signalType ?? '').toUpperCase().includes('RECLAIM')) {
      openType = 'RECLAIM_OPEN';
    } else if (rvol >= 3 && ext >= 4 && regime.includes('CHOP')) {
      openType = 'TRAP_OPEN';
    } else if (ext < 2 && rvol < 2) {
      openType = 'INSIDE_OPEN';
    } else if (regime.includes('TREND') && rvol >= 2 && ext >= 2) {
      openType = 'TREND_OPEN';
    } else if (vwapDist < -0.015 && ext >= 2) {
      openType = 'MEAN_REVERSION_OPEN';
    } else if (rvol >= 3.5 && ext >= 3) {
      openType = 'EXPANSION_OPEN';
    } else if (ext >= 4 && rvol < 2) {
      openType = 'FAILED_OPEN';
    }

    return {
      openType,
      label: openTypeLabel(openType),
      confidence: mins < OPEN_WINDOW_MIN ? 72 : 58,
      reclaimEnvironment: openType === 'RECLAIM_OPEN' || openType === 'OPENING_FLUSH',
      fakeBreakoutEnvironment: openType === 'TRAP_OPEN' || openType === 'FAILED_OPEN'
    };
  }

  /** Historical setup × open type expectancy cells. */
  analyze(signals: SignalSnapshot[]): OpenTypeAnalyticsCell[] {
    const opening = signals.filter(s => (s.sessionTimeMinutes ?? 999) < OPEN_WINDOW_MIN);
    const cells: OpenTypeAnalyticsCell[] = [];

    for (const setup of ['BREAKOUT', 'VWAP_RECLAIM', 'TREND_CONTINUATION', 'MOMENTUM'] as const) {
      for (const ot of OPEN_TYPES) {
        const subset = opening.filter(s => {
          const ctx: LiveExecutionContext = {
            symbol: s.symbol,
            signalType: s.signalType,
            marketRegime: s.marketRegime,
            rvol: s.rvol,
            vwapDistance: s.vwapDistance,
            sessionTimeMinutes: s.sessionTimeMinutes
          };
          return s.signalType === setup && this.classifyLive(ctx).openType === ot;
        });
        const evaluated = evaluatedSignals(subset);
        if (evaluated.length < 3) {
          cells.push({ setup, openType: ot, sampleCount: evaluated.length, expectancyR: 0, winRate: 0, tone: 'INSUFFICIENT' });
          continue;
        }
        const exp = computeExpectancyR(subset);
        const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
        const wr = pct(wins.length, evaluated.length);
        cells.push({
          setup,
          openType: ot,
          sampleCount: evaluated.length,
          expectancyR: exp,
          winRate: wr,
          tone: exp > 0.1 ? 'POSITIVE' : exp < -0.05 ? 'NEGATIVE' : 'NEUTRAL'
        });
      }
    }
    return cells;
  }
}

const OPEN_TYPES: OpenType[] = [
  'TREND_OPEN', 'GAP_AND_GO', 'OPENING_FLUSH', 'FAILED_OPEN', 'INSIDE_OPEN',
  'MEAN_REVERSION_OPEN', 'RECLAIM_OPEN', 'EXPANSION_OPEN', 'TRAP_OPEN'
];

function openTypeLabel(t: OpenType): string {
  return t.replace(/_/g, ' ');
}

export function openTypeStrength(t: OpenType): 'STRONG' | 'NEUTRAL' | 'WEAK' {
  switch (t) {
    case 'TREND_OPEN':
    case 'GAP_AND_GO':
    case 'RECLAIM_OPEN':
    case 'EXPANSION_OPEN':
      return 'STRONG';
    case 'TRAP_OPEN':
    case 'FAILED_OPEN':
      return 'WEAK';
    default:
      return 'NEUTRAL';
  }
}
