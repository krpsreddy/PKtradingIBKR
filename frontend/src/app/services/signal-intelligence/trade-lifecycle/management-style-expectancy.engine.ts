import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { ManagementStyle, ManagementStyleExpectancy } from './trade-lifecycle.models';
import { TradeManagementAnalyticsEngine } from './trade-management-analytics.engine';
import { realizedR } from './trade-lifecycle.util';

/** Expectancy by inferred management style — advisory comparison only. */
export class ManagementStyleExpectancyEngine {
  private readonly management = new TradeManagementAnalyticsEngine();

  analyze(signals: SignalSnapshot[]): ManagementStyleExpectancy[] {
    const evaluated = evaluatedSignals(signals);
    const styles: ManagementStyle[] = ['AGGRESSIVE_HOLD', 'FAST_PARTIAL', 'TRAILING_EXIT', 'EARLY_EXIT'];

    return styles.map(style => {
      const bucket = evaluated.filter(s => this.management.inferStyle(s) === style);
      const wins = bucket.filter(s => s.evaluation!.status === 'WIN');
      return {
        style,
        sampleCount: bucket.length,
        winRate: Math.round(pct(wins.length, Math.max(1, bucket.length))),
        expectancyR: bucket.length ? round2(computeExpectancyR(bucket)) : 0,
        avgMfeR: bucket.length ? round2(avgMfe(bucket)) : 0,
        avgRealizedR: bucket.length ? round2(avgRealized(bucket)) : 0
      };
    }).filter(r => r.sampleCount > 0)
      .sort((a, b) => b.expectancyR - a.expectancyR);
  }
}

function avgMfe(signals: SignalSnapshot[]): number {
  return signals.reduce((a, s) => a + (s.evaluation!.mfeR), 0) / signals.length;
}

function avgRealized(signals: SignalSnapshot[]): number {
  return signals.reduce((a, s) => a + realizedR(s), 0) / signals.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
