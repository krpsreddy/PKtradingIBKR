import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals } from '../signal-intelligence.math';
import { LiveDecisionEngine } from '../live-decision/live-decision-engine';
import { DecisionRegretReport } from './decision-feedback.models';
import { contextFromSignal, isFakeout, realizedR, round2 } from './decision-feedback.util';

/** Find false avoids, false traps, excessive waiting, and over-conservative zones. */
export class DecisionRegretEngine {
  private readonly decisionEngine = new LiveDecisionEngine();

  analyze(signals: SignalSnapshot[]): DecisionRegretReport {
    const evaluated = evaluatedSignals(signals);
    let falseAvoids = 0;
    let falseTrapWarnings = 0;
    let unnecessarySizeReductions = 0;
    let excessiveWaiting = 0;

    const conservativeBuckets = new Map<string, { missed: number; total: number }>();

    for (const s of evaluated) {
      const ctx = contextFromSignal(s, evaluated.length);
      const snap = this.decisionEngine.decide(ctx);
      const r = realizedR(s);
      const won = s.evaluation!.status === 'WIN';

      if ((snap.decision === 'AVOID_TRADE' || snap.decision === 'AVOID_CHASE') && won && r > 0.5) {
        falseAvoids++;
      }
      if (snap.decision === 'TRAP_RISK' && won && !isFakeout(s)) {
        falseTrapWarnings++;
      }
      if (snap.decision === 'REDUCE_SIZE' && won && r >= 1.5 && !isFakeout(s)) {
        unnecessarySizeReductions++;
      }
      if (snap.decision.includes('WAIT') && won && r >= 1.2) {
        excessiveWaiting++;
        const key = `${s.signalType ?? '—'} · ${s.marketRegime ?? '—'}`;
        const b = conservativeBuckets.get(key) ?? { missed: 0, total: 0 };
        conservativeBuckets.set(key, { missed: b.missed + 1, total: b.total + 1 });
      }
    }

    const overConservativeZones = [...conservativeBuckets.entries()]
      .filter(([, v]) => v.missed >= 3)
      .map(([label, v]) => ({
        label,
        sampleCount: v.total,
        note: `Excessive waiting missed ${v.missed} continuation winners`
      }))
      .sort((a, b) => b.sampleCount - a.sampleCount)
      .slice(0, 5);

    if (!overConservativeZones.length && excessiveWaiting >= 5) {
      overConservativeZones.push({
        label: 'Opening reclaim continuation',
        sampleCount: excessiveWaiting,
        note: 'Wait logic may be over-conservative in fast continuation environments'
      });
    }

    const total = evaluated.length || 1;
    const regretEvents = falseAvoids + falseTrapWarnings + unnecessarySizeReductions + excessiveWaiting;
    const regretScore = round2(Math.min(100, (regretEvents / total) * 100 * 2));

    return {
      regretScore,
      falseAvoids,
      falseTrapWarnings,
      unnecessarySizeReductions,
      excessiveWaiting,
      overConservativeZones,
      advisoryOnly: true
    };
  }
}
