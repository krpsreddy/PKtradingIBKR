import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  IntelligenceSignalType,
  MarketRegime,
  RegimePerformance,
  SignalAnalyticsSnapshot,
  SignalIntelligenceFilter,
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalSnapshot,
  SignalTypePerformance
} from '../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from './signal-intelligence.store';
import { avg, computeExpectancyR, pct } from './signal-intelligence.math';

export function createEmptyAnalyticsSnapshot(): SignalAnalyticsSnapshot {
  return {
    lookbackDays: SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
    totalSignals: 0,
    evaluatedSignals: 0,
    openSignals: 0,
    winRate: 0,
    lossRate: 0,
    neutralRate: 0,
    avgMfeR: 0,
    avgMaeR: 0,
    avgRR: 0,
    hit1RRate: 0,
    hit2RRate: 0,
    expectancyR: 0,
    bestRegime: null,
    worstRegime: null,
    bestSignalType: null,
    worstSignalType: null,
    byRegime: [],
    bySignalType: [],
    computedAt: Date.now()
  };
}

@Injectable({ providedIn: 'root' })
export class SignalAnalyticsService {
  private readonly analyticsSubject = new BehaviorSubject<SignalAnalyticsSnapshot>(
    createEmptyAnalyticsSnapshot()
  );
  readonly analytics$ = this.analyticsSubject.asObservable();

  constructor(private store: SignalIntelligenceStore) {
    this.store.revision$.subscribe(() => this.refresh());
    this.refresh();
  }

  snapshot(): SignalAnalyticsSnapshot {
    return this.analyticsSubject.value;
  }

  refresh(lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS): SignalAnalyticsSnapshot {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    const signals = this.store.query({ fromTs });
    const computed = this.compute(signals, lookbackDays);
    this.analyticsSubject.next(computed);
    return computed;
  }

  queryMetrics(filter: SignalIntelligenceFilter): SignalAnalyticsSnapshot {
    return this.compute(this.store.query(filter), SIGNAL_INTELLIGENCE_LOOKBACK_DAYS);
  }

  private compute(signals: SignalSnapshot[], lookbackDays: number): SignalAnalyticsSnapshot {
    const evaluated = signals.filter(s => s.evaluation?.evaluated);
    const open = signals.filter(s => s.evaluation?.status === 'OPEN' || !s.evaluation?.evaluated);
    const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
    const losses = evaluated.filter(s => s.evaluation!.status === 'LOSS');
    const neutrals = evaluated.filter(s => s.evaluation!.status === 'NEUTRAL');

    const winRate = pct(wins.length, evaluated.length);
    const lossRate = pct(losses.length, evaluated.length);
    const neutralRate = pct(neutrals.length, evaluated.length);

    const avgMfeR = avg(evaluated.map(s => s.evaluation!.mfeR));
    const avgMaeR = avg(evaluated.map(s => s.evaluation!.maeR));
    const avgRR = avg(signals.map(s => s.riskReward).filter((v): v is number => v != null));
    const hit1RRate = pct(evaluated.filter(s => s.evaluation!.hit1R).length, evaluated.length);
    const hit2RRate = pct(evaluated.filter(s => s.evaluation!.hit2R).length, evaluated.length);
    const expectancyR = computeExpectancyR(signals);

    const byRegime = this.regimeBreakdown(signals);
    const bySignalType = this.signalTypeBreakdown(signals);

    const bestRegime = pickExtreme(byRegime, true);
    const worstRegime = pickExtreme(byRegime, false);
    const bestSignalType = pickTypeExtreme(bySignalType, true);
    const worstSignalType = pickTypeExtreme(bySignalType, false);

    return {
      lookbackDays,
      totalSignals: signals.length,
      evaluatedSignals: evaluated.length,
      openSignals: open.length,
      winRate,
      lossRate,
      neutralRate,
      avgMfeR,
      avgMaeR,
      avgRR,
      hit1RRate,
      hit2RRate,
      expectancyR,
      bestRegime,
      worstRegime,
      bestSignalType,
      worstSignalType,
      byRegime,
      bySignalType,
      computedAt: Date.now()
    };
  }

  private regimeBreakdown(signals: SignalSnapshot[]): RegimePerformance[] {
    const regimes: MarketRegime[] = ['TREND', 'CHOP', 'BREAKOUT', 'CALM', 'EXITING'];
    return regimes
      .map(regime => this.bucket(signals.filter(s => s.marketRegime === regime), regime))
      .filter(r => r.count > 0)
      .sort((a, b) => b.winRate - a.winRate);
  }

  private signalTypeBreakdown(signals: SignalSnapshot[]): SignalTypePerformance[] {
    const types: IntelligenceSignalType[] = [
      'BREAKOUT', 'VWAP_RECLAIM', 'TREND_CONTINUATION', 'REVERSAL', 'MOMENTUM'
    ];
    return types
      .map(t => this.typeBucket(signals.filter(s => s.signalType === t), t))
      .filter(r => r.count > 0)
      .sort((a, b) => b.winRate - a.winRate);
  }

  private bucket(signals: SignalSnapshot[], regime: MarketRegime): RegimePerformance {
    const evaluated = signals.filter(s => s.evaluation?.evaluated);
    const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
    return {
      regime,
      count: signals.length,
      winRate: pct(wins.length, evaluated.length),
      hit1RRate: pct(evaluated.filter(s => s.evaluation!.hit1R).length, evaluated.length),
      avgMfeR: avg(evaluated.map(s => s.evaluation!.mfeR)),
      avgMaeR: avg(evaluated.map(s => s.evaluation!.maeR))
    };
  }

  private typeBucket(signals: SignalSnapshot[], signalType: IntelligenceSignalType): SignalTypePerformance {
    const evaluated = signals.filter(s => s.evaluation?.evaluated);
    const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
    return {
      signalType,
      count: signals.length,
      winRate: pct(wins.length, evaluated.length),
      hit1RRate: pct(evaluated.filter(s => s.evaluation!.hit1R).length, evaluated.length),
      avgMfeR: avg(evaluated.map(s => s.evaluation!.mfeR)),
      avgMaeR: avg(evaluated.map(s => s.evaluation!.maeR)),
      expectancyR: computeExpectancyR(signals)
    };
  }

  private emptySnapshot(): SignalAnalyticsSnapshot {
    return createEmptyAnalyticsSnapshot();
  }
}

function pickExtreme(rows: RegimePerformance[], best: boolean): RegimePerformance | null {
  const eligible = rows.filter(r => r.count >= 3);
  if (!eligible.length) return null;
  return eligible.reduce((a, b) => best ? (a.winRate >= b.winRate ? a : b) : (a.winRate <= b.winRate ? a : b));
}

function pickTypeExtreme(rows: SignalTypePerformance[], best: boolean): SignalTypePerformance | null {
  const eligible = rows.filter(r => r.count >= 3);
  if (!eligible.length) return null;
  return eligible.reduce((a, b) => best ? (a.winRate >= b.winRate ? a : b) : (a.winRate <= b.winRate ? a : b));
}
