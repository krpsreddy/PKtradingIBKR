import {
  FalseBreakoutRegimeStat,
  FalseBreakoutRvolStat,
  FalseBreakoutSnapshot,
  FalseBreakoutTimeStat,
  MarketRegime,
  SignalSnapshot,
  TrapRiskLevel
} from '../../models/signal-intelligence.model';
import { avg, evaluatedSignals, pct } from './signal-intelligence.math';

export const DEFAULT_REVERSAL_WINDOW_BARS = 6;

const BREAKOUT_TYPES = new Set(['BREAKOUT', 'MOMENTUM']);

const TIME_WINDOWS: { label: string; match: (m: number) => boolean }[] = [
  { label: '9:30–9:45', match: m => m >= 0 && m < 15 },
  { label: '9:45–10:15', match: m => m >= 15 && m < 45 },
  { label: '10:15–11:00', match: m => m >= 45 && m < 90 },
  { label: '11:00+', match: m => m >= 90 }
];

const RVOL_BUCKETS: { label: string; match: (r: number) => boolean }[] = [
  { label: '<1.5', match: r => r < 1.5 },
  { label: '1.5–3', match: r => r >= 1.5 && r < 3 },
  { label: '3–5', match: r => r >= 3 && r < 5 },
  { label: '>5', match: r => r >= 5 }
];

/**
 * False breakout: triggered above level, reversed within N bars, failed +1R.
 * Deterministic proxy from evaluated signal snapshots — no ML.
 */
export class FalseBreakoutAnalyticsEngine {

  analyze(signals: SignalSnapshot[], reversalWindowBars = DEFAULT_REVERSAL_WINDOW_BARS): FalseBreakoutSnapshot {
    const breakouts = signals.filter(s => BREAKOUT_TYPES.has(s.signalType));
    const evaluated = evaluatedSignals(breakouts);
    const falseOnes = evaluated.filter(s => this.isFalseBreakout(s, reversalWindowBars));

    const rate = pct(falseOnes.length, evaluated.length);
    const reversalBars = falseOnes.map(s => s.evaluation!.barsHeld);
    const reversalMin = falseOnes.map(s => s.evaluation!.durationMinutes);

    const fakeoutScore = Math.round(Math.min(100, Math.max(0, rate * 0.85 + (100 - continuationQuality(evaluated)) * 0.15)));
    const trapRisk = trapRiskLevel(rate, fakeoutScore);
    const contQuality = continuationQuality(evaluated);

    return {
      breakoutSampleCount: evaluated.length,
      falseBreakoutRate: rate,
      avgReversalBars: avg(reversalBars),
      avgReversalMinutes: avg(reversalMin),
      fakeoutScore,
      trapRisk,
      continuationQuality: contQuality,
      label: fakeoutLabel(trapRisk, rate),
      byRegime: this.byRegime(evaluated, reversalWindowBars),
      byRvol: this.byRvol(evaluated, reversalWindowBars),
      byTimeOfDay: this.byTime(evaluated, reversalWindowBars),
      reversalWindowBars
    };
  }

  analyzeSymbol(signals: SignalSnapshot[], symbol: string, reversalWindowBars = DEFAULT_REVERSAL_WINDOW_BARS): FalseBreakoutSnapshot {
    return this.analyze(signals.filter(s => s.symbol === symbol.toUpperCase()), reversalWindowBars);
  }

  isFalseBreakout(s: SignalSnapshot, reversalWindowBars = DEFAULT_REVERSAL_WINDOW_BARS): boolean {
    if (!BREAKOUT_TYPES.has(s.signalType)) return false;
    const ev = s.evaluation;
    if (!ev?.evaluated || ev.status === 'OPEN') return false;
    if (ev.hit1R) return false;

    const entry = s.entryPrice;
    if (!entry || entry <= 0) return false;

    const fast = ev.barsHeld <= reversalWindowBars;
    if (!fast) return false;

    if (s.direction === 'LONG') {
      const triggered = ev.maxPriceSeen > entry * 1.001;
      const reversed = ev.minPriceSeen < entry || ev.stoppedOut;
      return triggered && reversed && ev.mfeR < 0.85;
    }

    const triggered = ev.minPriceSeen < entry * 0.999;
    const reversed = ev.maxPriceSeen > entry || ev.stoppedOut;
    return triggered && reversed && ev.mfeR < 0.85;
  }

  private byRegime(signals: SignalSnapshot[], window: number): FalseBreakoutRegimeStat[] {
    const regimes: MarketRegime[] = ['TREND', 'CHOP', 'BREAKOUT', 'CALM', 'EXITING'];
    return regimes.map(regime => {
      const rows = signals.filter(s => s.marketRegime === regime);
      const falseCount = rows.filter(s => this.isFalseBreakout(s, window)).length;
      return {
        regime,
        sampleCount: rows.length,
        falseBreakoutRate: pct(falseCount, rows.length)
      };
    }).filter(r => r.sampleCount >= 3).sort((a, b) => b.falseBreakoutRate - a.falseBreakoutRate);
  }

  private byRvol(signals: SignalSnapshot[], window: number): FalseBreakoutRvolStat[] {
    return RVOL_BUCKETS.map(b => {
      const rows = signals.filter(s => b.match(s.rvol ?? 0));
      const falseCount = rows.filter(s => this.isFalseBreakout(s, window)).length;
      return { bucket: b.label, sampleCount: rows.length, falseBreakoutRate: pct(falseCount, rows.length) };
    }).filter(r => r.sampleCount >= 3).sort((a, b) => b.falseBreakoutRate - a.falseBreakoutRate);
  }

  private byTime(signals: SignalSnapshot[], window: number): FalseBreakoutTimeStat[] {
    return TIME_WINDOWS.map(w => {
      const rows = signals.filter(s => w.match(s.sessionTimeMinutes ?? 0));
      const falseCount = rows.filter(s => this.isFalseBreakout(s, window)).length;
      return { window: w.label, sampleCount: rows.length, falseBreakoutRate: pct(falseCount, rows.length) };
    }).filter(r => r.sampleCount >= 3).sort((a, b) => b.falseBreakoutRate - a.falseBreakoutRate);
  }
}

function continuationQuality(evaluated: SignalSnapshot[]): number {
  if (!evaluated.length) return 50;
  const hit1 = evaluated.filter(s => s.evaluation!.hit1R).length;
  const wins = evaluated.filter(s => s.evaluation!.status === 'WIN').length;
  return Math.round((pct(hit1, evaluated.length) * 0.55 + pct(wins, evaluated.length) * 0.45));
}

function trapRiskLevel(falseRate: number, fakeoutScore: number): TrapRiskLevel {
  if (falseRate >= 55 || fakeoutScore >= 70) return 'HIGH';
  if (falseRate >= 35 || fakeoutScore >= 45) return 'MEDIUM';
  return 'LOW';
}

function fakeoutLabel(trap: TrapRiskLevel, rate: number): string {
  if (trap === 'HIGH') return 'HIGH TRAP RISK';
  if (trap === 'MEDIUM') return 'LATE BREAKOUT';
  if (rate <= 25) return 'LOW FAKEOUT RISK';
  return 'EARLY ACCEPTANCE';
}
