import { AutonomousDiscoveryReport } from '../autonomous-discovery/autonomous-discovery.models';
import { PreExpansionFeatureExtractorEngine } from '../autonomous-discovery/pre-expansion-feature-extractor.engine';
import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { AutonomousExecutionInput } from './autonomous-execution.models';

/** Match live context to discovered cluster centroids. */
export class AutonomousPatternMatcherEngine {
  private readonly extractor = new PreExpansionFeatureExtractorEngine();

  match(
    input: AutonomousExecutionInput,
    report: AutonomousDiscoveryReport | null
  ): { cluster: string | null; similarity: number; expectedR: number | null } {
    if (!report?.discoveredStrategies.length) {
      return { cluster: null, similarity: 0, expectedR: null };
    }
    const snap = this.toSnapshot(input);
    const ctx = this.extractor.buildContext([snap]);
    const vec = this.extractor.extract(snap, ctx);
    let best: { name: string; sim: number; avgR: number } | null = null;
    for (const s of report.discoveredStrategies) {
      if (s.confidence === 'INSUFFICIENT') continue;
      const sim = (vec.structureScore / 100) * 0.4
        + (vec.rvolQ / 4) * 0.25
        + (vec.trendQ / 4) * 0.2
        + (vec.pullbackDepthQ <= 1 ? 0.15 : 0);
      if (!best || sim > best.sim) best = { name: s.name, sim, avgR: s.avgR };
    }
    return {
      cluster: best?.name ?? null,
      similarity: best?.sim ?? 0,
      expectedR: best?.avgR ?? null
    };
  }

  private toSnapshot(input: AutonomousExecutionInput): SignalSnapshot {
    return {
      id: 'match',
      symbol: input.symbol,
      timestamp: Date.now(),
      timeframe: '5m',
      direction: 'LONG',
      signalType: 'MOMENTUM',
      marketRegime: 'TREND',
      entryPrice: 100,
      stopPrice: 98,
      convictionScore: input.convictionScore ?? 50,
      rvol: input.rvol ?? 1,
      trendAlignment: input.trendAlignment ?? 50,
      vwapDistance: input.vwapDistance,
      sessionTimeMinutes: input.sessionTimeMinutes,
      volatility: input.volatility,
      extendedEntry: input.extended,
      captureStage: 'READY',
      createdAt: Date.now()
    };
  }
}
