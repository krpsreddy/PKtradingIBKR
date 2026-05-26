import { AutonomousDiscoveryReport } from '../autonomous-discovery/autonomous-discovery.models';
import { PreExpansionFeatureExtractorEngine } from '../autonomous-discovery/pre-expansion-feature-extractor.engine';
import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { ContinuationParticipationInput } from './continuation-participation.models';
import { ExpansionParticipationEngine } from './expansion-participation-engine';
import { PullbackContinuationEngine } from './pullback-continuation-engine';
import { VwapAcceptanceContinuationEngine } from './vwap-acceptance-continuation.engine';
import { EarlyExpansionWindowEngine } from './early-expansion-window.engine';
import { ContinuationAddEngine } from './continuation-add-engine';
import { ContinuationRiskBalanceEngine } from './continuation-risk-balance.engine';

/** Composite continuationParticipationScore. */
export class ParticipationConfidenceEngine {
  private readonly expansion = new ExpansionParticipationEngine();
  private readonly pull = new PullbackContinuationEngine();
  private readonly vwap = new VwapAcceptanceContinuationEngine();
  private readonly early = new EarlyExpansionWindowEngine();
  private readonly add = new ContinuationAddEngine();
  private readonly risk = new ContinuationRiskBalanceEngine();
  private readonly extractor = new PreExpansionFeatureExtractorEngine();

  score(input: ContinuationParticipationInput, report: AutonomousDiscoveryReport | null): {
    score: number;
    matchedArchetype: string | null;
    similarity: number;
  } {
    const balanced = this.risk.balanceScore(input);
    const components = [
      this.expansion.score(input),
      this.pull.score(input),
      this.vwap.score(input),
      this.early.score(input),
      this.add.score(input)
    ];
    const base = Math.round(components.reduce((a, b) => a + b, 0) / components.length);
    const { matched, similarity } = this.matchArchetype(input, report);
    const archetypeBoost = matched && similarity >= 0.6 ? Math.round(similarity * 15) : 0;
    const regretBoost = report?.governanceSuppressedPatterns.some(g =>
      g.strategyName === matched && g.avgMissedR >= 2
    ) ? 8 : 0;
    const final = Math.min(100, Math.round((base + balanced) / 2) + archetypeBoost + regretBoost);
    return { score: final, matchedArchetype: matched, similarity };
  }

  private matchArchetype(
    input: ContinuationParticipationInput,
    report: AutonomousDiscoveryReport | null
  ): { matched: string | null; similarity: number } {
    if (!report?.discoveredStrategies.length) return { matched: null, similarity: 0 };
    const snap = this.inputToSnapshot(input);
    const ctx = this.extractor.buildContext([snap]);
    const vec = this.extractor.extract(snap, ctx);
    let best: { name: string; sim: number } | null = null;
    for (const s of report.discoveredStrategies) {
      if (!s.promotable && s.confidence === 'INSUFFICIENT') continue;
      const sim = this.vectorSimilarity(vec, s.conditions.length);
      if (!best || sim > best.sim) best = { name: s.name, sim };
    }
    return { matched: best?.name ?? null, similarity: best?.sim ?? 0 };
  }

  private vectorSimilarity(vec: { rvolQ: number; trendQ: number; structureScore: number }, condCount: number): number {
    const structNorm = vec.structureScore / 100;
    const rvolNorm = vec.rvolQ / 4;
    const trendNorm = vec.trendQ / 4;
    const base = (structNorm + rvolNorm + trendNorm) / 3;
    return Math.min(1, base + (condCount >= 4 ? 0.1 : 0));
  }

  private inputToSnapshot(input: ContinuationParticipationInput): SignalSnapshot {
    return {
      id: 'live',
      symbol: input.symbol,
      timestamp: Date.now(),
      timeframe: '5m',
      direction: 'LONG',
      signalType: 'MOMENTUM',
      marketRegime: 'TREND',
      entryPrice: 100,
      stopPrice: 98,
      convictionScore: input.convictionScore ?? input.trendAlignment ?? 50,
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
