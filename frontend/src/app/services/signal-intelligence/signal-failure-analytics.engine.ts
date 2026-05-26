import {
  FailureFactorId,
  FailureFactorStat,
  SignalSnapshot
} from '../../models/signal-intelligence.model';
import { confidenceFromCount, pct } from './signal-intelligence.math';

interface FactorRule {
  id: FailureFactorId;
  label: string;
  matches: (s: SignalSnapshot) => boolean;
}

const RULES: FactorRule[] = [
  { id: 'CHOP_REGIME', label: 'CHOP REGIME', matches: s => s.marketRegime === 'CHOP' },
  { id: 'LOW_RVOL', label: 'RVOL < 1.8', matches: s => s.rvol < 1.8 },
  { id: 'WEAK_EMA', label: 'WEAK EMA STACK', matches: s => s.emaAlignment === false },
  { id: 'EXTENDED_ENTRY', label: 'EXTENDED ENTRY', matches: s => s.extendedEntry === true || Math.abs(s.vwapDistance ?? 0) > 0.012 },
  { id: 'WEAK_TREND', label: 'WEAK TREND ALIGNMENT', matches: s => s.trendAlignment < 50 },
  { id: 'LOW_CONVICTION', label: 'LOW CONVICTION', matches: s => s.convictionScore < 40 },
  { id: 'LATE_ENTRY', label: 'LATE ENTRY', matches: s => s.captureStage === 'ENTERED' },
  {
    id: 'FAILED_CONTINUATION',
    label: 'FAILED CONTINUATION',
    matches: s => s.signalType === 'TREND_CONTINUATION' && s.evaluation?.stoppedOut === true
  }
];

/** Correlates loss outcomes with observable pre-trade factors — deterministic only. */
export class SignalFailureAnalyticsEngine {

  analyze(signals: SignalSnapshot[]): FailureFactorStat[] {
    const losses = signals.filter(s => s.evaluation?.evaluated && s.evaluation.status === 'LOSS');
    const evaluated = signals.filter(s => s.evaluation?.evaluated && s.evaluation.status !== 'OPEN');
    if (!losses.length) return [];

    return RULES
      .map(rule => {
        const matching = evaluated.filter(rule.matches);
        const lossHits = losses.filter(rule.matches);
        return {
          id: rule.id,
          label: rule.label,
          lossCount: lossHits.length,
          lossRate: pct(lossHits.length, matching.length),
          sampleCount: matching.length,
          confidence: confidenceFromCount(matching.length)
        };
      })
      .filter(r => r.lossCount > 0)
      .sort((a, b) => b.lossCount - a.lossCount);
  }

  fastestFailuresLabel(signals: SignalSnapshot[]): string | null {
    const losses = signals.filter(s => s.evaluation?.evaluated && s.evaluation.status === 'LOSS');
    if (losses.length < 3) return null;

    const buckets: { label: string; count: number; avgBars: number }[] = [];

    const lowRvolBreakouts = losses.filter(s =>
      s.signalType === 'BREAKOUT' && s.rvol < 1.8
    );
    if (lowRvolBreakouts.length >= 2) {
      buckets.push({
        label: 'LOW RVOL BREAKOUTS',
        count: lowRvolBreakouts.length,
        avgBars: avgBarsHeld(lowRvolBreakouts)
      });
    }

    const chopLosses = losses.filter(s => s.marketRegime === 'CHOP');
    if (chopLosses.length >= 2) {
      buckets.push({
        label: 'CHOP REGIME',
        count: chopLosses.length,
        avgBars: avgBarsHeld(chopLosses)
      });
    }

    const lateReversals = losses.filter(s =>
      s.signalType === 'REVERSAL' && (s.evaluation?.durationMinutes ?? 99) <= 20
    );
    if (lateReversals.length >= 2) {
      buckets.push({
        label: 'FAST REVERSAL FAILURES',
        count: lateReversals.length,
        avgBars: avgBarsHeld(lateReversals)
      });
    }

    if (!buckets.length) return null;
    buckets.sort((a, b) => a.avgBars - b.avgBars || b.count - a.count);
    return buckets[0].label;
  }
}

function avgBarsHeld(signals: SignalSnapshot[]): number {
  const bars = signals.map(s => s.evaluation?.barsHeld ?? 0);
  return bars.reduce((a, b) => a + b, 0) / Math.max(1, bars.length);
}
