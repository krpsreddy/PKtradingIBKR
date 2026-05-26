import { Injectable } from '@angular/core';
import {
  ConditionCluster,
  DailyEdgeDiscoveryReport,
  EdgeDiscoveryAiSummary,
  EdgeDiscoveryCompressedPayload,
  ExecutionEdgeGateResult,
  ExecutionEdgeGateState
} from './edge-discovery.models';
import { EdgeGateContext } from '../edge-activation-gate.service';
import { MarketRegime } from '../../../models/signal-intelligence.model';
import { normalizeSetup } from '../live-execution/live-execution-context.util';
import { rvolBucket, timeWindow } from './edge-cluster-metrics.util';

function breadthFromTrend(t: number): string {
  if (t >= 70) return 'STRONG';
  if (t >= 50) return 'MID';
  return 'WEAK';
}

/** Statistical execution gating from discovered clusters — advisory only. */
@Injectable({ providedIn: 'root' })
export class ExecutionEdgeGateService {

  evaluate(report: DailyEdgeDiscoveryReport, ctx: EdgeGateContext): ExecutionEdgeGateResult {
    const cluster = this.matchCluster(report.discovery.clusters, ctx);
    const toxic = report.toxicConditions.some(t => this.matchesContext(t, ctx));
    const suppression = report.recommendedSuppressions.find(s =>
      cluster && s.clusterId === cluster.id
    );

    let state: ExecutionEdgeGateState = 'EDGE_ACTIVE';
    const reasons: string[] = [];

    if (toxic || cluster?.edgeState === 'TOXIC') {
      state = 'TOXIC';
      reasons.push('Matched toxic condition cluster');
    } else if (suppression?.severity === 'SUPPRESS' || suppression?.severity === 'AVOID') {
      state = 'NO_EDGE';
      reasons.push(suppression.label);
    } else if (cluster?.edgeState === 'NO_EDGE' || cluster?.edgeState === 'WEAK_EDGE') {
      state = 'NO_EDGE';
      reasons.push(`Negative expectancy cluster (${cluster.metrics.expectancyR.toFixed(2)}R)`);
    } else if (cluster?.edgeState === 'HIGH_EDGE' && cluster.edgeScore >= 65) {
      state = 'EDGE_ACTIVE';
      reasons.push('High-edge cluster matched');
    } else if (cluster?.edgeState === 'MODERATE_EDGE') {
      state = 'SELECTIVE';
      reasons.push('Moderate edge — selective execution only');
    } else if (cluster && cluster.metrics.fakeoutRate >= 40) {
      state = 'REDUCE_SIZE';
      reasons.push(`Elevated fakeout (${cluster.metrics.fakeoutRate}%)`);
    } else if (!cluster || cluster.metrics.sampleCount < 10) {
      state = 'OBSERVE_ONLY';
      reasons.push('Insufficient cluster evidence');
    } else {
      state = 'SELECTIVE';
      reasons.push('Neutral cluster — proceed selectively');
    }

    return {
      state,
      label: gateLabel(state),
      reasons,
      matchedCluster: cluster,
      edgeScore: cluster?.edgeScore ?? (report.discovery.totalEvaluated > 0 ? 40 : 0),
      advisoryOnly: true
    };
  }

  private matchCluster(clusters: ConditionCluster[], ctx: EdgeGateContext): ConditionCluster | null {
    const setup = normalizeSetup(ctx.signalType);
    const regime = normalizeRegime(ctx.marketRegime);
    const rvol = rvolBucket(ctx.rvol ?? 1);
    const time = timeWindow(ctx.sessionTimeMinutes ?? 999);
    const breadth = breadthFromTrend(ctx.trendAlignment ?? 50);

    const candidates = clusters.filter(c => c.setup === setup);
    if (!candidates.length) return null;

    const scored = candidates.map(c => {
      let fit = c.metrics.sampleCount;
      if (!c.regime || c.regime === regime) fit += 40;
      if (c.rvolBucket === rvol) fit += 25;
      if (c.timeWindow === time) fit += 20;
      if (c.breadthBucket === breadth) fit += 15;
      return { c, fit };
    });

    return scored.sort((a, b) => b.fit - a.fit)[0]?.c ?? null;
  }

  private matchesContext(c: ConditionCluster, ctx: EdgeGateContext): boolean {
    const setup = normalizeSetup(ctx.signalType);
    const regime = normalizeRegime(ctx.marketRegime);
    return c.setup === setup && (!c.regime || c.regime === regime) && c.edgeState === 'TOXIC';
  }
}

function normalizeRegime(raw?: string | null): MarketRegime {
  const u = (raw ?? 'TREND').toUpperCase();
  if (u.includes('CHOP')) return 'CHOP';
  if (u.includes('BREAK')) return 'BREAKOUT';
  if (u.includes('CALM')) return 'CALM';
  if (u.includes('EXIT')) return 'EXITING';
  return 'TREND';
}

function gateLabel(state: ExecutionEdgeGateState): string {
  switch (state) {
    case 'EDGE_ACTIVE': return 'EDGE ACTIVE';
    case 'SELECTIVE': return 'SELECTIVE';
    case 'REDUCE_SIZE': return 'REDUCE SIZE';
    case 'OBSERVE_ONLY': return 'OBSERVE ONLY';
    case 'NO_EDGE': return 'NO EDGE';
    case 'TOXIC': return 'TOXIC';
  }
}

export function buildCompressedPayload(report: DailyEdgeDiscoveryReport): EdgeDiscoveryCompressedPayload {
  return {
    lookbackDays: report.lookbackDays,
    totalEvaluated: report.discovery.totalEvaluated,
    topEdge: report.strongestConditions.slice(0, 6).map(c => ({
      label: c.label,
      exp: c.metrics.expectancyR,
      n: c.metrics.sampleCount
    })),
    toxic: report.toxicConditions.slice(0, 6).map(c => ({
      label: c.label,
      exp: c.metrics.expectancyR,
      n: c.metrics.sampleCount
    })),
    suppressions: report.recommendedSuppressions.slice(0, 8).map(s => s.label),
    symbolRanks: report.symbolRankings.slice(0, 8).map(s => ({
      symbol: s.symbol,
      score: s.edgeScore,
      rank: s.capitalRank
    })),
    decay: report.weakeningEdges.slice(0, 4).map(d => d.message)
  };
}

/** Deterministic AI-style synthesis — no ML, analytics authoritative. */
export function synthesizeEdgeDiscovery(report: DailyEdgeDiscoveryReport): EdgeDiscoveryAiSummary {
  const top = report.strongestConditions[0];
  const toxic = report.toxicConditions[0];
  const bestSym = report.bestSymbols[0];
  const suppressions = report.recommendedSuppressions.slice(0, 4).map(s => s.label);
  const anomalies: string[] = [];

  if (report.weakeningEdges.length) {
    anomalies.push(report.weakeningEdges[0].message);
  }
  if (report.risingFakeoutEnvironments.length) {
    anomalies.push(report.risingFakeoutEnvironments[0].message);
  }

  return {
    summary: report.discovery.totalEvaluated >= 10
      ? `${report.lookbackDays}D edge discovery — ${report.discovery.totalEvaluated} evaluated signals, ${report.discovery.highEdge.length} high-edge clusters, ${report.toxicConditions.length} toxic environments identified.`
      : 'Insufficient evaluated history for high-confidence edge discovery.',
    strongestEdge: top
      ? `${top.label} (+${top.metrics.expectancyR.toFixed(2)}R, n=${top.metrics.sampleCount}, WR ${top.metrics.winRate}%)`
      : 'No high-edge cluster with adequate samples',
    topToxic: toxic
      ? `${toxic.label} (${toxic.metrics.expectancyR.toFixed(2)}R, fakeout ${toxic.metrics.fakeoutRate}%)`
      : 'No toxic cluster detected',
    capitalGuidance: bestSym
      ? `Allocate selectively toward ${bestSym.symbol} (edge ${bestSym.edgeScore}, ${bestSym.capitalRank})`
      : 'No symbol meets capital rank thresholds',
    suppressions,
    anomalies,
    provider: 'deterministic',
    fallbackUsed: true
  };
}
