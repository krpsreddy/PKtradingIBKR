import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { EntryAcceptanceState, EntryEvolutionPath, LiveEntrySequencingInput } from './entry-sequencing.models';
import { deriveStateSequence, finalState, pathDegraded, pathImproved, extensionPct } from './entry-sequencing.util';

/** Model deterministic execution progression through acceptance states. */
export class EntryAcceptanceSequencingEngine {

  sequence(s: SignalSnapshot, sampleCount = 0): EntryEvolutionPath {
    const states = deriveStateSequence(s);
    const ev = s.evaluation;
    const outcomeR = ev?.status === 'WIN'
      ? (ev.hit2R ? 2 : ev.hit1R ? 1 : Math.min(ev.mfeR, 1))
      : ev?.status === 'LOSS' ? ev.maeR : (ev?.mfeR ?? 0) * 0.35;

    return {
      signalId: s.id,
      symbol: s.symbol,
      setup: s.signalType,
      regime: s.marketRegime,
      states,
      finalState: finalState(states),
      improved: pathImproved(states),
      degraded: pathDegraded(states),
      outcomeR: Math.round(outcomeR * 100) / 100,
      advisoryOnly: true
    };
  }

  sequenceMany(signals: SignalSnapshot[]): EntryEvolutionPath[] {
    return signals.map(s => this.sequence(s, signals.length));
  }

  /** Live proxy — infer current state from context + shallow window proxies. */
  liveState(input: LiveEntrySequencingInput): EntryAcceptanceState {
    const synthetic = this.buildSnapshot(input);
    return finalState(deriveStateSequence(synthetic));
  }

  buildSnapshot(input: LiveEntrySequencingInput): SignalSnapshot {
    const ext = input.extended ?? extensionPct({ vwapDistance: input.vwapDistance } as SignalSnapshot) >= 5;
    const eq = (input.entryQuality ?? '').toUpperCase();
    const mfeProxy = ext ? 0.15 : 0.35;
    const maeProxy = eq.includes('CHASE') ? -0.55 : -0.25;

    return {
      id: 'live-seq',
      symbol: input.symbol.toUpperCase(),
      timestamp: Date.now(),
      timeframe: '5m',
      direction: 'LONG',
      signalType: (input.signalType as SignalSnapshot['signalType']) ?? 'MOMENTUM',
      marketRegime: (input.marketRegime as SignalSnapshot['marketRegime']) ?? 'TREND',
      entryPrice: 100,
      stopPrice: 98,
      convictionScore: 70,
      rvol: input.rvol ?? 2,
      trendAlignment: input.trendAlignment ?? 60,
      vwapDistance: input.vwapDistance,
      sessionTimeMinutes: input.sessionTimeMinutes,
      extendedEntry: ext,
      captureStage: 'TRIGGERED',
      createdAt: Date.now(),
      evaluation: {
        evaluated: true,
        status: 'OPEN',
        mfe: 0, mae: 0, mfePercent: 0, maePercent: 0,
        mfeR: mfeProxy, maeR: maeProxy,
        hit1R: false, hit2R: false, stoppedOut: false, targetHit: false,
        barsHeld: 2, durationMinutes: 5,
        maxPriceSeen: 100, minPriceSeen: 99,
        evaluatedAt: Date.now(),
        evaluationWindowMinutes: 60,
        windows: [
          { windowMinutes: 5, mfeR: mfeProxy, maeR: maeProxy, hit1R: false, hit2R: false, stoppedOut: false, status: 'OPEN' },
          { windowMinutes: 15, mfeR: mfeProxy * 1.1, maeR: maeProxy, hit1R: false, hit2R: false, stoppedOut: false, status: 'OPEN' }
        ]
      }
    };
  }
}
