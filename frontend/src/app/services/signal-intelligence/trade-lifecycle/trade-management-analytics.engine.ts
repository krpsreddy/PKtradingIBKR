import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import { ExitQualityMetrics, ManagementAnalyticsSnapshot, ManagementStyle } from './trade-lifecycle.models';
import { realizedR, resolveEntryTiming } from './trade-lifecycle.util';

/** Exit quality — efficiency, give-back, trailing proxies (advisory only). */
export class ExitQualityEngine {

  aggregate(signals: SignalSnapshot[]): ExitQualityMetrics {
    const evaluated = evaluatedSignals(signals);
    if (!evaluated.length) {
      return {
        exitEfficiency: 50,
        gaveBackProfitPct: 0,
        unrealizedExpectancyR: 0,
        realizedExpectancyR: 0,
        reversalAwareness: 50,
        trailingQuality: 50
      };
    }

    const unrealized = evaluated.reduce((a, s) => a + (s.evaluation!.mfeR), 0) / evaluated.length;
    const realized = evaluated.reduce((a, s) => a + realizedR(s), 0) / evaluated.length;
    const gaveBack = evaluated.filter(s => {
      const ev = s.evaluation!;
      return ev.mfeR >= 0.8 && realizedR(s) < ev.mfeR * 0.55;
    });
    const efficient = evaluated.filter(s => {
      const ev = s.evaluation!;
      const r = realizedR(s);
      if (ev.status === 'WIN') return r >= ev.mfeR * 0.65;
      return ev.maeR > -0.65;
    });
    const reversalAware = evaluated.filter(s => {
      const ev = s.evaluation!;
      return ev.mfeR >= 0.5 && (ev.stoppedOut || ev.status === 'LOSS') && ev.maeR < -0.4;
    });
    const trailingGood = evaluated.filter(s => {
      const ev = s.evaluation!;
      return ev.hit1R && realizedR(s) >= 0.75;
    });

    return {
      exitEfficiency: Math.round(pct(efficient.length, evaluated.length)),
      gaveBackProfitPct: Math.round(pct(gaveBack.length, evaluated.length)),
      unrealizedExpectancyR: round2(unrealized),
      realizedExpectancyR: round2(realized),
      reversalAwareness: Math.round(100 - pct(reversalAware.length, evaluated.length)),
      trailingQuality: Math.round(pct(trailingGood.length, Math.max(1, evaluated.filter(s => s.evaluation!.hit1R).length)))
    };
  }

  perTrade(signal: SignalSnapshot): number {
    const ev = signal.evaluation;
    if (!ev?.evaluated) return 50;
    const r = realizedR(signal);
    if (ev.status === 'WIN') {
      if (ev.mfeR <= 0) return 55;
      return Math.round(Math.min(100, (r / ev.mfeR) * 100));
    }
    if (ev.maeR > -0.5) return 62;
    return 35;
  }
}

/** Management analytics — premature exits, exhaustion holds, scaling quality. */
export class TradeManagementAnalyticsEngine {

  analyze(signals: SignalSnapshot[]): ManagementAnalyticsSnapshot {
    const evaluated = evaluatedSignals(signals);
    if (!evaluated.length) {
      return emptyManagement();
    }

    const premature = evaluated.filter(s => {
      const ev = s.evaluation!;
      return ev.mfeR >= 1.2 && realizedR(s) < 0.5 && ev.status !== 'LOSS';
    });
    const heldExhaustion = evaluated.filter(s => {
      const ev = s.evaluation!;
      return ev.mfeR >= 1 && realizedR(s) < 0.2 && ev.durationMinutes > 45;
    });
    const missedPartial = evaluated.filter(s => {
      const ev = s.evaluation!;
      return ev.hit1R && !ev.hit2R && ev.mfeR >= 1.6 && realizedR(s) < 0.85;
    });
    const poorStop = evaluated.filter(s => s.evaluation!.maeR < -1.1);
    const addExtension = evaluated.filter(s => s.extendedEntry && s.captureStage === 'ENTERED');
    const scalingGood = evaluated.filter(s => {
      const ev = s.evaluation!;
      return ev.hit1R && !s.extendedEntry && resolveEntryTiming(s) !== 'CHASE';
    });

    const exitEngine = new ExitQualityEngine();
    const exitEff = exitEngine.aggregate(signals).exitEfficiency;

    const labels: string[] = [];
    if (pct(premature.length, evaluated.length) >= 25) labels.push('PREMATURE EXIT PATTERN');
    if (pct(heldExhaustion.length, evaluated.length) >= 20) labels.push('HELD THROUGH EXHAUSTION');
    if (pct(missedPartial.length, evaluated.length) >= 30) labels.push('MISSED PARTIALS');
    if (pct(poorStop.length, evaluated.length) >= 15) labels.push('POOR STOP DISCIPLINE');
    if (pct(addExtension.length, evaluated.length) >= 20) labels.push('ADDING INTO EXTENSION');

    return {
      prematureExitRate: Math.round(pct(premature.length, evaluated.length)),
      heldThroughExhaustionRate: Math.round(pct(heldExhaustion.length, evaluated.length)),
      missedPartialRate: Math.round(pct(missedPartial.length, evaluated.length)),
      poorStopDisciplineRate: Math.round(pct(poorStop.length, evaluated.length)),
      addedIntoExtensionRate: Math.round(pct(addExtension.length, evaluated.length)),
      scalingQuality: Math.round(pct(scalingGood.length, evaluated.length)),
      exitEfficiency: exitEff,
      labels
    };
  }

  inferStyle(signal: SignalSnapshot): ManagementStyle {
    const ev = signal.evaluation;
    if (!ev?.evaluated) return 'EARLY_EXIT';
    const r = realizedR(signal);
    if (ev.hit2R || (ev.durationMinutes > 50 && r >= 1.2)) return 'AGGRESSIVE_HOLD';
    if (ev.hit1R && r >= 0.7 && r < ev.mfeR * 0.85) return 'TRAILING_EXIT';
    if (ev.hit1R && r < 0.85) return 'FAST_PARTIAL';
    return 'EARLY_EXIT';
  }
}

function emptyManagement(): ManagementAnalyticsSnapshot {
  return {
    prematureExitRate: 0,
    heldThroughExhaustionRate: 0,
    missedPartialRate: 0,
    poorStopDisciplineRate: 0,
    addedIntoExtensionRate: 0,
    scalingQuality: 50,
    exitEfficiency: 50,
    labels: []
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
