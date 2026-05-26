import { ConfidenceLevel, ConfidenceRating, SignalSnapshot } from '../../models/signal-intelligence.model';

export function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.round((n / d) * 1000) / 10;
}

export function avg(values: number[]): number {
  if (!values.length) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

export function confidenceFromCount(sampleCount: number): ConfidenceRating {
  let level: ConfidenceLevel;
  if (sampleCount < 10) level = 'LOW';
  else if (sampleCount <= 30) level = 'MEDIUM';
  else if (sampleCount <= 100) level = 'HIGH';
  else level = 'VERY_HIGH';

  const label = level === 'LOW' ? 'LOW CONFIDENCE'
    : level === 'MEDIUM' ? 'MEDIUM CONFIDENCE'
    : level === 'HIGH' ? 'HIGH CONFIDENCE'
    : 'VERY HIGH CONFIDENCE';

  return { level, sampleCount, label };
}

/** True when outcome is known — tolerates legacy payloads missing `evaluation.evaluated`. */
export function isEvaluatedSignal(s: SignalSnapshot): boolean {
  const st = s.evaluation?.status;
  if (st === 'WIN' || st === 'LOSS' || st === 'NEUTRAL') return true;
  return !!(s.evaluation?.evaluated && st !== 'OPEN');
}

export function evaluatedSignals(signals: SignalSnapshot[]): SignalSnapshot[] {
  return signals.filter(isEvaluatedSignal);
}

/** Normalize server/hydrated payloads so discovery & edge lab see evaluated rows. */
export function normalizeSignalSnapshot(s: SignalSnapshot): SignalSnapshot {
  if (!s?.id) return s;
  const ev = s.evaluation;
  if (!ev) return s;
  const status = ev.status;
  if ((status === 'WIN' || status === 'LOSS' || status === 'NEUTRAL') && !ev.evaluated) {
    return { ...s, evaluation: { ...ev, evaluated: true } };
  }
  return s;
}

export function computeExpectancyR(signals: SignalSnapshot[]): number {
  const evaluated = evaluatedSignals(signals);
  if (!evaluated.length) return 0;
  const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
  const losses = evaluated.filter(s => s.evaluation!.status === 'LOSS');
  const winRate = pct(wins.length, evaluated.length);
  const lossRate = pct(losses.length, evaluated.length);
  const avgWinR = avg(wins.map(s => s.evaluation!.mfeR));
  const avgLossR = avg(losses.map(s => Math.abs(s.evaluation!.maeR)));
  return Math.round(((winRate / 100) * avgWinR - (lossRate / 100) * avgLossR) * 100) / 100;
}

export function formatSetupLabel(signalType: string | undefined | null): string {
  if (!signalType) return '—';
  return signalType.replace(/_/g, ' ');
}
