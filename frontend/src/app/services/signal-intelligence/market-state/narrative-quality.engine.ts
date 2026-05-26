import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { confidenceFromCount } from '../signal-intelligence.math';
import { breadthBucket } from '../edge-discovery/edge-cluster-metrics.util';
import { extensionPct } from '../entry-sequencing/entry-sequencing.util';
import { NarrativeQualitySnapshot } from './market-state.models';
import { deriveMarketStateSequence, finalMarketState, inferTrajectory, round2 } from './market-state.util';
import { MarketStateMachineEngine } from './market-state-machine.engine';

/** Score narrative quality 0–100 from transition stability and alignment. */
export class NarrativeQualityEngine {
  private readonly machine = new MarketStateMachineEngine();

  score(signal: SignalSnapshot): NarrativeQualitySnapshot {
    const path = this.machine.path(signal);
    const states = path.states;
    const n = states.length;

    const strongTransitions = path.transitions.filter(t => t.quality === 'STRONG').length;
    const stability = n ? round2((strongTransitions / Math.max(1, path.transitions.length)) * 100) : 50;

    const breadth = breadthBucket(signal);
    const breadthAlignment = breadth === 'STRONG' ? 85 : breadth === 'MODERATE' ? 60 : 35;

    const reclaimQuality = states.includes('VWAP_RECLAIM') && states.includes('ACCEPTANCE') ? 80
      : states.includes('VWAP_RECLAIM') ? 55 : 40;

    const continuationHealth = ['SECOND_LEG_CONTINUATION', 'TREND_EXPANSION', 'ACCEPTANCE'].includes(path.current) ? 75 : 40;

    const ext = extensionPct(signal);
    const extensionRisk = ext >= 8 ? 20 : ext >= 5 ? 45 : 70;

    const trajectory = inferTrajectory(states);
    const trajectoryBonus = trajectory === 'NARRATIVE_IMPROVING' ? 10 : trajectory === 'NARRATIVE_FAILING' ? -15 : 0;

    const raw = stability * 0.25 + breadthAlignment * 0.2 + reclaimQuality * 0.2
      + continuationHealth * 0.2 + extensionRisk * 0.15 + trajectoryBonus;

    return {
      score: Math.max(0, Math.min(100, Math.round(raw))),
      stability: round2(stability),
      breadthAlignment: round2(breadthAlignment),
      reclaimQuality: round2(reclaimQuality),
      continuationHealth: round2(continuationHealth),
      extensionRisk: round2(extensionRisk),
      confidence: confidenceFromCount(n)
    };
  }

  scoreLive(states: ReturnType<typeof deriveMarketStateSequence>, trendAlignment = 50): number {
    const current = finalMarketState(states);
    let score = 50;
    if (['ACCEPTANCE', 'SECOND_LEG_CONTINUATION'].includes(current)) score += 25;
    if (current === 'FAILED_ACCEPTANCE' || current === 'TRAP_REVERSAL') score -= 30;
    if (trendAlignment >= 70) score += 10;
    if (trendAlignment < 50) score -= 10;
    return Math.max(0, Math.min(100, score));
  }
}
