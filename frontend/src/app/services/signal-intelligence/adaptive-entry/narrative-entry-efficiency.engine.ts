import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { avg, evaluatedSignals } from '../signal-intelligence.math';
import { pathKey, deriveMarketStateSequence } from '../market-state/market-state.util';
import { NarrativeEntryEfficiencyRow } from './adaptive-entry.models';
import {
  classifyEntryLocation,
  classifyEntryWindow,
  entryMfeProxy,
  narrativeCapturePct,
  round2
} from './adaptive-entry.util';

/** Measure how much of total narrative move was captured at entry. */
export class NarrativeEntryEfficiencyEngine {
  analyze(signals: SignalSnapshot[]): { rows: NarrativeEntryEfficiencyRow[]; avgCapturePct: number } {
    const evaluated = evaluatedSignals(signals);
    const rows: NarrativeEntryEfficiencyRow[] = evaluated.map(s => {
      const window = classifyEntryWindow(s);
      const entryMfe = entryMfeProxy(s, window);
      const capturePct = narrativeCapturePct(s, entryMfe);
      return {
        signalId: s.id,
        narrativePath: pathKey(deriveMarketStateSequence(s)),
        entryLocation: classifyEntryLocation(s),
        capturePct,
        narrativeMfeR: round2(s.evaluation!.mfeR),
        entryMfeR: round2(entryMfe)
      };
    });

    const avgCapturePct = round2(avg(rows.map(r => r.capturePct)));
    return { rows: rows.slice(0, 200), avgCapturePct };
  }

  captureForSignal(s: SignalSnapshot): number {
    const window = classifyEntryWindow(s);
    return narrativeCapturePct(s, entryMfeProxy(s, window));
  }
}
