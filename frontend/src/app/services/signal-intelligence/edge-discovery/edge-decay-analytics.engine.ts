import { EdgeDecaySignal, EdgeDecaySnapshot } from './edge-discovery.models';
import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals } from '../signal-intelligence.math';
import { computeClusterMetrics, rvolBucket, timeWindow } from './edge-cluster-metrics.util';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Detects when historically strong conditions stop working (early vs late lookback split). */
export class EdgeDecayAnalyticsEngine {

  analyze(signals: SignalSnapshot[], lookbackDays = 60): EdgeDecaySnapshot {
    const evaluated = evaluatedSignals(signals);
    if (evaluated.length < 20) {
      return { weakening: [], risingFakeout: [] };
    }

    const mid = Date.now() - (lookbackDays / 2) * 86_400_000;
    const early = evaluated.filter(s => s.timestamp < mid);
    const late = evaluated.filter(s => s.timestamp >= mid);

    const weakening: EdgeDecaySignal[] = [];
    const risingFakeout: EdgeDecaySignal[] = [];

    const keys = this.clusterKeys(evaluated);
    for (const key of keys) {
      const eEarly = early.filter(key.match);
      const eLate = late.filter(key.match);
      if (eEarly.length < 5 || eLate.length < 5) continue;

      const mEarly = computeClusterMetrics(eEarly);
      const mLate = computeClusterMetrics(eLate);
      const decayPct = mEarly.expectancyR > 0.01
        ? Math.round((1 - mLate.expectancyR / mEarly.expectancyR) * 1000) / 10
        : 0;

      if (mEarly.expectancyR > 0.08 && mLate.expectancyR < mEarly.expectancyR * 0.6 && decayPct > 25) {
        weakening.push({
          clusterLabel: key.label,
          earlyExpectancyR: mEarly.expectancyR,
          lateExpectancyR: mLate.expectancyR,
          decayPct,
          fakeoutDelta: mLate.fakeoutRate - mEarly.fakeoutRate,
          message: `${key.label} edge weakening (${mEarly.expectancyR.toFixed(2)}R → ${mLate.expectancyR.toFixed(2)}R)`
        });
      }

      const foEarly = eEarly.filter(s => falseBreakout.isFalseBreakout(s)).length;
      const foLate = eLate.filter(s => falseBreakout.isFalseBreakout(s)).length;
      const rateEarly = eEarly.length ? (foEarly / eEarly.length) * 100 : 0;
      const rateLate = eLate.length ? (foLate / eLate.length) * 100 : 0;
      if (rateLate - rateEarly >= 15 && rateLate >= 35) {
        risingFakeout.push({
          clusterLabel: key.label,
          earlyExpectancyR: mEarly.expectancyR,
          lateExpectancyR: mLate.expectancyR,
          decayPct,
          fakeoutDelta: Math.round((rateLate - rateEarly) * 10) / 10,
          message: `${key.label} fakeout frequency increasing (+${Math.round(rateLate - rateEarly)}%)`
        });
      }
    }

    return {
      weakening: weakening.sort((a, b) => b.decayPct - a.decayPct).slice(0, 8),
      risingFakeout: risingFakeout.sort((a, b) => b.fakeoutDelta - a.fakeoutDelta).slice(0, 8)
    };
  }

  private clusterKeys(signals: SignalSnapshot[]): { label: string; match: (s: SignalSnapshot) => boolean }[] {
    const setups = [...new Set(signals.map(s => s.signalType))];
    const regimes = [...new Set(signals.map(s => s.marketRegime))];
    const keys: { label: string; match: (s: SignalSnapshot) => boolean }[] = [];

    for (const setup of setups) {
      keys.push({
        label: setup.replace(/_/g, ' '),
        match: s => s.signalType === setup
      });
      for (const regime of regimes) {
        keys.push({
          label: `${setup.replace(/_/g, ' ')} + ${regime}`,
          match: s => s.signalType === setup && s.marketRegime === regime
        });
      }
    }

    for (const sym of [...new Set(signals.map(s => s.symbol))]) {
      keys.push({
        label: `${sym} continuation`,
        match: s => s.symbol === sym && s.signalType === 'TREND_CONTINUATION'
      });
      keys.push({
        label: `${sym} breakout`,
        match: s => s.symbol === sym && s.signalType === 'BREAKOUT'
      });
    }

    keys.push({
      label: 'BREAKOUT + CHOP',
      match: s => s.signalType === 'BREAKOUT' && s.marketRegime === 'CHOP'
    });

    return keys;
  }
}
