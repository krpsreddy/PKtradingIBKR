import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { AcceptanceTransitionStat, EntryEvolutionPath } from './entry-sequencing.models';
import { EntryAcceptanceSequencingEngine } from './entry-acceptance-sequencing.engine';
import { pathLabel } from './entry-sequencing.util';

/** Track state transitions and aggregate transition statistics. */
export class AcceptanceTransitionEngine {
  private readonly sequencer = new EntryAcceptanceSequencingEngine();

  analyze(signals: SignalSnapshot[]): {
    paths: EntryEvolutionPath[];
    transitions: AcceptanceTransitionStat[];
    commonPaths: { path: string; count: number; expectancyR: number }[];
  } {
    const paths = this.sequencer.sequenceMany(evaluatedSignals(signals));
    return {
      paths,
      transitions: this.aggregateTransitions(paths),
      commonPaths: this.commonPaths(paths)
    };
  }

  private aggregateTransitions(paths: EntryEvolutionPath[]): AcceptanceTransitionStat[] {
    const map = new Map<string, EntryEvolutionPath[]>();

    for (const p of paths) {
      for (let i = 0; i < p.states.length - 1; i++) {
        const key = `${p.states[i]}→${p.states[i + 1]}`;
        map.set(key, [...(map.get(key) ?? []), p]);
      }
    }

    return [...map.entries()]
      .map(([key, bucket]) => {
        const [from, to] = key.split('→') as [AcceptanceTransitionStat['from'], AcceptanceTransitionStat['to']];
        const wins = bucket.filter(p => p.outcomeR > 0);
        return {
          from,
          to,
          count: bucket.length,
          winRate: pct(wins.length, bucket.length),
          expectancyR: avgR(bucket.map(p => p.outcomeR))
        };
      })
      .filter(t => t.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private commonPaths(paths: EntryEvolutionPath[]): { path: string; count: number; expectancyR: number }[] {
    const map = new Map<string, EntryEvolutionPath[]>();
    for (const p of paths) {
      const label = pathLabel(p.states);
      map.set(label, [...(map.get(label) ?? []), p]);
    }
    return [...map.entries()]
      .map(([path, bucket]) => ({
        path,
        count: bucket.length,
        expectancyR: avgR(bucket.map(p => p.outcomeR))
      }))
      .filter(r => r.count >= 2)
      .sort((a, b) => b.expectancyR - a.expectancyR || b.count - a.count)
      .slice(0, 10);
  }
}

function avgR(vals: number[]): number {
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}
