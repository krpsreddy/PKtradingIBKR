import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import { PlaybookLifecycleInsight } from './trade-lifecycle.models';
import { TradeLifecycleEngine } from './trade-lifecycle.engine';
import { avgHealth, healthScore, playbookKey, playbookLabel, resolveEntryTiming } from './trade-lifecycle.util';

/** Playbook lifecycle — sustain, fail-fast, exhaust, scaling vs chasing. */
export class PlaybookLifecycleEngine {
  private readonly lifecycle = new TradeLifecycleEngine();

  analyze(signals: SignalSnapshot[]): PlaybookLifecycleInsight[] {
    const evaluated = evaluatedSignals(signals);
    const byKey = new Map<string, SignalSnapshot[]>();
    for (const s of evaluated) {
      const k = playbookKey(s);
      const list = byKey.get(k) ?? [];
      list.push(s);
      byKey.set(k, list);
    }

    const insights: PlaybookLifecycleInsight[] = [];
    for (const [key, bucket] of byKey) {
      if (bucket.length < 3) continue;
      const paths = bucket.map(s => this.lifecycle.buildPath(s));
      const failFast = bucket.filter(s => {
        const ev = s.evaluation!;
        return ev.stoppedOut && (ev.durationMinutes ?? 0) < 20;
      });
      const exhaustEarly = paths.filter(p =>
        p.events.some(e => e.state === 'EXHAUSTION') && p.realizedR < 0.5
      );
      const scalingReward = bucket.filter(s => s.evaluation!.hit2R);
      const chasePenalty = bucket.filter(s => resolveEntryTiming(s) === 'CHASE' && s.evaluation!.status === 'LOSS');

      insights.push({
        playbookKey: key,
        label: playbookLabel(key),
        sampleCount: bucket.length,
        avgContinuationHealth: avgHealth(paths),
        sustainScore: Math.round(pct(paths.filter(p => p.acceptance === 'ACCEPTED').length, paths.length)),
        failFastRate: Math.round(pct(failFast.length, bucket.length)),
        exhaustEarlyRate: Math.round(pct(exhaustEarly.length, bucket.length)),
        scalingReward: Math.round(pct(scalingReward.length, bucket.length)),
        chasePenalty: Math.round(pct(chasePenalty.length, bucket.length))
      });
    }

    return insights.sort((a, b) => b.sustainScore - a.sustainScore || b.sampleCount - a.sampleCount);
  }
}

export { healthScore };
