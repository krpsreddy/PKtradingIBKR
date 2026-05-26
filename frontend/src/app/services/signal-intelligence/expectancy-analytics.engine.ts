import {
  ExpectancyRow,
  IntelligenceSignalType,
  MarketRegime,
  SignalSnapshot
} from '../../models/signal-intelligence.model';
import { computeExpectancyR, confidenceFromCount, evaluatedSignals, pct } from './signal-intelligence.math';

/** Deterministic expectancy decomposition — no optimization, no leakage. */
export class ExpectancyAnalyticsEngine {

  global(signals: SignalSnapshot[]): number {
    return computeExpectancyR(signals);
  }

  byRegime(signals: SignalSnapshot[]): ExpectancyRow[] {
    const regimes: MarketRegime[] = ['TREND', 'CHOP', 'BREAKOUT', 'CALM', 'EXITING'];
    return regimes
      .map(regime => this.row(signals.filter(s => s.marketRegime === regime), regime, regime))
      .filter(r => r.sampleCount > 0)
      .sort((a, b) => b.expectancyR - a.expectancyR);
  }

  bySetup(signals: SignalSnapshot[]): ExpectancyRow[] {
    const types: IntelligenceSignalType[] = [
      'BREAKOUT', 'VWAP_RECLAIM', 'TREND_CONTINUATION', 'REVERSAL', 'MOMENTUM'
    ];
    return types
      .map(t => this.row(signals.filter(s => s.signalType === t), t, t.replace(/_/g, ' ')))
      .filter(r => r.sampleCount > 0)
      .sort((a, b) => b.expectancyR - a.expectancyR);
  }

  byTimeframe(signals: SignalSnapshot[]): ExpectancyRow[] {
    const frames = [...new Set(signals.map(s => s.timeframe))].sort();
    return frames
      .map(tf => this.row(signals.filter(s => s.timeframe === tf), tf, tf))
      .filter(r => r.sampleCount > 0)
      .sort((a, b) => b.expectancyR - a.expectancyR);
  }

  private row(signals: SignalSnapshot[], key: string, label: string): ExpectancyRow {
    const evaluated = evaluatedSignals(signals);
    const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
    return {
      key,
      label,
      sampleCount: evaluated.length,
      winRate: pct(wins.length, evaluated.length),
      expectancyR: computeExpectancyR(signals),
      confidence: confidenceFromCount(evaluated.length)
    };
  }
}
