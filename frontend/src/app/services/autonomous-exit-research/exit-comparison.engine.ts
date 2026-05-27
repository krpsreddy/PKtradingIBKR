import {
  ExitResearchSnapshot,
  ModelRanking,
  RegimeModelInsight,
  ShadowExitModelId,
  ShadowExitPath
} from './shadow-exit.models';
import { ALL_SHADOW_EXIT_MODELS } from './shadow-exit.models';

export function rankShadowModels(paths: ShadowExitPath[]): ModelRanking[] {
  const byModel = new Map<ShadowExitModelId, ShadowExitPath[]>();
  for (const id of ALL_SHADOW_EXIT_MODELS) byModel.set(id, []);
  for (const p of paths) {
    byModel.get(p.modelId)?.push(p);
  }

  return ALL_SHADOW_EXIT_MODELS.map(modelId => {
    const list = byModel.get(modelId) ?? [];
    const n = list.length || 1;
    const avgRealizedR = list.reduce((s, p) => s + p.simulatedExitR, 0) / n;
    const avgMfeRetainedPct = list.reduce((s, p) => s + p.mfeRetainedPct, 0) / n;
    const avgCont = list.reduce((s, p) => s + p.continuationMonetizationEfficiency, 0) / n;
    const avgMae = list.reduce((s, p) => s + p.maeExperienced, 0) / n;
    const score = avgCont * 0.45 + avgMfeRetainedPct * 0.35 + avgRealizedR * 800 * 0.2;
    return {
      modelId,
      sampleCount: list.length,
      avgRealizedR,
      avgMfeRetainedPct,
      avgContinuationEfficiency: avgCont,
      avgMae,
      score
    };
  }).sort((a, b) => b.score - a.score);
}

export function regimeInsights(paths: ShadowExitPath[]): RegimeModelInsight[] {
  const regimes = [...new Set(paths.map(p => p.regime))];
  return regimes.map(regime => {
    const subset = paths.filter(p => p.regime === regime);
    const rankings = rankShadowModels(subset);
    return {
      regime,
      bestModel: rankings[0]?.modelId ?? 'ADAPTIVE_TRAIL',
      rankings
    };
  });
}

export function buildExitResearchSnapshot(paths: ShadowExitPath[]): ExitResearchSnapshot {
  const rankings = rankShadowModels(paths);
  const regimeInsightsList = regimeInsights(paths);
  const survivalBuckets = ['0-2m', '2-5m', '5-10m', '10m+'].map((bucket, i) => ({
    bucket,
    survivalPct: clamp(85 - i * 18 + (rankings[0]?.avgContinuationEfficiency ?? 0) * 0.1, 20, 95)
  }));
  const secondLegRankings = rankings.map(r => ({
    modelId: r.modelId,
    capturePct: clamp(r.avgContinuationEfficiency * 0.9, 0, 100)
  }));

  return {
    paths,
    rankings,
    regimeInsights: regimeInsightsList,
    continuationSurvivalCurve: survivalBuckets,
    persistenceHalfLifeMin: 6.5,
    secondLegRankings,
    generatedAt: Date.now()
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
