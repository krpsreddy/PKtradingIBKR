import { SymbolEdgeCompressedSummary } from './models/symbol-edge.models';

/** Deterministic symbol personality label from edge stats (advisory only). */
export function deriveSymbolPersonality(
  summary: SymbolEdgeCompressedSummary,
  aiSummary?: string | null
): string {
  const trimmed = aiSummary?.trim();
  if (trimmed && trimmed.length > 12 && !trimmed.includes('local mode')) {
    const first = trimmed.split(/[.!]/)[0]?.trim();
    if (first && first.length > 12) return first.slice(0, 140);
  }

  const { overall, lateEntryPenalty, worstRegime, bestSetup, byTimeOfDay } = summary;
  const latePenalty = lateEntryPenalty.expectancyDropPct;
  const mae = Math.abs(overall.avgMae);

  if (latePenalty > 30 && mae > 0.8) {
    return 'High fakeout volatility — entries degrade quickly after trigger';
  }
  if (overall.expectancy > 0.2 && overall.winRate > 55 && isMomentum(bestSetup?.type)) {
    return 'Institutional continuation behavior — momentum setups lead';
  }
  if (overall.expectancy > 0.1 && byTimeOfDay.some(t => t.bucket.includes('11:00') && t.expectancy > 0.15)) {
    return 'Slow grind continuation — mid-session trends persist';
  }
  if (isReclaim(bestSetup?.type)) {
    return 'Clean reclaim continuation — VWAP holds define edge';
  }
  if (worstRegime && (worstRegime.name.includes('CHOP') || worstRegime.name.includes('RANGE'))) {
    return 'Regime-sensitive — edge collapses in chop and range';
  }
  if (overall.expectancy < 0) {
    return 'Negative expectancy — highly selective execution required';
  }
  if (overall.winRate > 60 && overall.expectancy > 0.1) {
    return 'Reliable continuation profile — timing filters amplify edge';
  }
  return 'Mixed edge profile — regime and timing filters critical';
}

function isMomentum(type?: string | null): boolean {
  if (!type) return false;
  const u = type.toUpperCase();
  return u.includes('MOM') || u.includes('BREAK') || u.includes('OPEN');
}

function isReclaim(type?: string | null): boolean {
  if (!type) return false;
  const u = type.toUpperCase();
  return u.includes('RECLAIM') || u.includes('VWAP') || u.includes('PULL');
}
