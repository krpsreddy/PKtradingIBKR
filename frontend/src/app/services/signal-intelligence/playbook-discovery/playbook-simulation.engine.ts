import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { PlaybookCandidate, PlaybookSimulationResult } from './playbook-candidate.models';
import { buildSequenceStep, extractSessionSequences, groupBySession, sequenceKey } from './playbook-sequence.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Simulate candidate playbooks against historical signals — advisory only. */
export class PlaybookSimulationEngine {

  simulate(candidate: PlaybookCandidate, signals: SignalSnapshot[]): PlaybookSimulationResult {
    const targetKey = sequenceKey(candidate.sequence);
    const matched: SignalSnapshot[] = [];

    for (const session of groupBySession(evaluatedSignals(signals))) {
      for (const seq of extractSessionSequences(session.signals, [candidate.sequence.length])) {
        if (seq.length !== candidate.sequence.length) continue;
        const steps = seq.map((s, i) => buildSequenceStep(s, i > 0 ? seq[i - 1] : undefined));
        if (sequenceKey(steps) !== targetKey) continue;
        matched.push(seq[seq.length - 1]);
      }
    }

    const n = matched.length;
    const wins = matched.filter(s => s.evaluation!.status === 'WIN');
    const falseOnes = matched.filter(s => falseBreakout.isFalseBreakout(s));
    const cumulative = matched.map(s => outcomeR(s));
    let peak = 0;
    let maxDd = 0;
    let sum = 0;
    for (const r of cumulative) {
      sum += r;
      peak = Math.max(peak, sum);
      maxDd = Math.max(maxDd, peak - sum);
    }

    const regimeMap = new Map<string, SignalSnapshot[]>();
    for (const s of matched) {
      const list = regimeMap.get(s.marketRegime) ?? [];
      list.push(s);
      regimeMap.set(s.marketRegime, list);
    }

    return {
      candidateId: candidate.id,
      expectancyR: computeExpectancyR(matched),
      winRate: pct(wins.length, Math.max(1, n)),
      fakeoutRate: pct(falseOnes.length, Math.max(1, n)),
      maxDrawdownR: Math.round(maxDd * 100) / 100,
      regimeSensitivity: [...regimeMap.entries()].map(([regime, list]) => ({
        regime,
        expectancyR: computeExpectancyR(list),
        count: list.length
      })).sort((a, b) => b.count - a.count),
      sampleCount: n,
      advisoryOnly: true
    };
  }
}

function outcomeR(s: SignalSnapshot): number {
  const ev = s.evaluation!;
  if (ev.status === 'WIN') return ev.mfeR;
  if (ev.status === 'LOSS') return -Math.abs(ev.maeR);
  return 0;
}
