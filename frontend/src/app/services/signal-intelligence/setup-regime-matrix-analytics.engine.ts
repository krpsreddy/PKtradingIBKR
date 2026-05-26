import {
  IntelligenceSignalType,
  MarketRegime,
  SetupRegimeMatrixCell,
  SetupRegimeMatrixSnapshot,
  SetupRegimePivotCell,
  SignalSnapshot
} from '../../models/signal-intelligence.model';
import {
  avg,
  computeExpectancyR,
  confidenceFromCount,
  evaluatedSignals,
  pct
} from './signal-intelligence.math';

export const SETUP_REGIME_MATRIX_MIN_SAMPLE = 5;

const SETUPS: IntelligenceSignalType[] = [
  'BREAKOUT', 'VWAP_RECLAIM', 'TREND_CONTINUATION', 'REVERSAL', 'MOMENTUM'
];
const REGIMES: MarketRegime[] = ['TREND', 'CHOP', 'BREAKOUT', 'CALM', 'EXITING'];

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

/** Deterministic setup×regime×time×RVOL expectancy matrix — analytics only. */
export class SetupRegimeMatrixAnalyticsEngine {

  analyze(signals: SignalSnapshot[], minSample = SETUP_REGIME_MATRIX_MIN_SAMPLE): SetupRegimeMatrixSnapshot {
    const cells: SetupRegimeMatrixCell[] = [];

    for (const setup of SETUPS) {
      for (const regime of REGIMES) {
        for (const tw of TIME_WINDOWS) {
          for (const rb of RVOL_BUCKETS) {
            const bucket = signals.filter(s =>
              s.signalType === setup
              && s.marketRegime === regime
              && tw.match(s.sessionTimeMinutes ?? 0)
              && rb.match(s.rvol ?? 0)
            );
            const cell = this.buildCell(setup, regime, tw.label, rb.label, bucket, minSample);
            if (cell) cells.push(cell);
          }
        }
      }
    }

    const sorted = [...cells].sort((a, b) => b.expectancyR - a.expectancyR);
    const pivot = this.buildPivot(signals, minSample);

    return {
      cells: sorted,
      pivot,
      bestCombinations: sorted.filter(c => c.edgeTone === 'POSITIVE').slice(0, 5),
      worstCombinations: [...sorted].reverse().filter(c => c.edgeTone === 'NEGATIVE').slice(0, 5),
      unstableCombinations: sorted.filter(c => this.isUnstable(c)),
      minSample
    };
  }

  /** Symbol-scoped matrix for Edge Lab. */
  analyzeSymbol(signals: SignalSnapshot[], symbol: string, minSample = SETUP_REGIME_MATRIX_MIN_SAMPLE): SetupRegimeMatrixSnapshot {
    const sym = symbol.toUpperCase();
    return this.analyze(signals.filter(s => s.symbol === sym), minSample);
  }

  private buildPivot(signals: SignalSnapshot[], minSample: number): SetupRegimePivotCell[] {
    const pivot: SetupRegimePivotCell[] = [];
    for (const setup of SETUPS) {
      for (const regime of REGIMES) {
        const bucket = signals.filter(s => s.signalType === setup && s.marketRegime === regime);
        const evaluated = evaluatedSignals(bucket);
        if (evaluated.length < minSample) continue;
        const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
        const exp = computeExpectancyR(bucket);
        pivot.push({
          setup,
          regime,
          sampleCount: evaluated.length,
          winRate: pct(wins.length, evaluated.length),
          expectancyR: exp,
          edgeTone: edgeTone(exp, evaluated.length, pct(wins.length, evaluated.length))
        });
      }
    }
    return pivot.sort((a, b) => b.expectancyR - a.expectancyR);
  }

  private buildCell(
    setup: IntelligenceSignalType,
    regime: MarketRegime,
    timeWindow: string,
    rvolBucket: string,
    signals: SignalSnapshot[],
    minSample: number
  ): SetupRegimeMatrixCell | null {
    const evaluated = evaluatedSignals(signals);
    if (evaluated.length < minSample) return null;

    const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
    const hit1 = evaluated.filter(s => s.evaluation!.hit1R);
    const hit2 = evaluated.filter(s => s.evaluation!.hit2R);
    const exp = computeExpectancyR(signals);
    const wr = pct(wins.length, evaluated.length);

    return {
      setup,
      regime,
      timeWindow,
      rvolBucket,
      label: `${setup.replace(/_/g, ' ')} + ${regime}`,
      sampleCount: evaluated.length,
      winRate: wr,
      expectancyR: exp,
      avgMfeR: avg(evaluated.map(s => s.evaluation!.mfeR)),
      avgMaeR: avg(evaluated.map(s => s.evaluation!.maeR)),
      hit1RRate: pct(hit1.length, evaluated.length),
      hit2RRate: pct(hit2.length, evaluated.length),
      confidence: confidenceFromCount(evaluated.length),
      edgeTone: edgeTone(exp, evaluated.length, wr)
    };
  }

  private isUnstable(cell: SetupRegimeMatrixCell): boolean {
    if (cell.sampleCount < SETUP_REGIME_MATRIX_MIN_SAMPLE) return false;
    const nearZero = Math.abs(cell.expectancyR) <= 0.12;
    const coinFlip = cell.winRate >= 40 && cell.winRate <= 55;
    const highMae = Math.abs(cell.avgMaeR) > 0.85 && cell.expectancyR <= 0.05;
    return (nearZero && coinFlip) || (coinFlip && highMae);
  }
}

export function edgeTone(
  expectancyR: number,
  sampleCount: number,
  winRate: number
): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' {
  if (sampleCount < SETUP_REGIME_MATRIX_MIN_SAMPLE) return 'NEUTRAL';
  if (expectancyR > 0.1 && winRate >= 50) return 'POSITIVE';
  if (expectancyR < -0.1 && winRate <= 48) return 'NEGATIVE';
  return 'NEUTRAL';
}
