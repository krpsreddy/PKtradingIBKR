import { LiveRegimeInput } from '../live-regime-intelligence/live-regime.models';
import { REGIME_THRESHOLDS } from './regime-threshold-engine';
import { FeatureContribution } from './explainable-regime.models';

/** Stepwise conviction / score contributions with running totals. */
export class FeatureContributionEngine {
  buildPersistenceContributions(input: LiveRegimeInput): FeatureContribution[] {
    const T = REGIME_THRESHOLDS.persistence;
    const vwap = input.vwapDistance ?? 0;
    const rvol = input.rvol ?? 0;
    const structure = input.structureScore ?? input.trendAlignment ?? 0;
    let total = T.base;
    const rows: FeatureContribution[] = [{
      feature: 'persistence_base',
      formula: 'continuationPersistenceScore base',
      delta: T.base,
      runningTotal: total,
      reason: `base=${T.base}`
    }];

    const push = (feature: string, formula: string, delta: number, reason: string) => {
      if (delta === 0) return;
      total += delta;
      rows.push({ feature, formula, delta, runningTotal: total, reason });
    };

    if (vwap >= 0) push('vwap_above_zero', 'vwapDistance ≥ 0', T.vwapAboveZero, `vwap=${vwap.toFixed(4)}`);
    if (vwap >= T.vwapSweetMin && vwap < T.vwapSweetMax) {
      push('vwap_sweet_spot', `vwap ∈ [${T.vwapSweetMin}, ${T.vwapSweetMax})`, T.vwapSweetSpot, `vwap=${vwap.toFixed(4)}`);
    }
    if (rvol >= T.rvolHighMin) push('rvol_high', `rvol ≥ ${T.rvolHighMin}`, T.rvolHigh, `rvol=${rvol.toFixed(2)}`);
    else if (rvol >= T.rvolMidMin) push('rvol_mid', `rvol ≥ ${T.rvolMidMin}`, T.rvolMid, `rvol=${rvol.toFixed(2)}`);
    if (structure >= T.structureHighMin) push('structure_high', `structure ≥ ${T.structureHighMin}`, T.structureHigh, `structure=${structure}`);
    else if (structure >= T.structureMidMin) push('structure_mid', `structure ≥ ${T.structureMidMin}`, T.structureMid, `structure=${structure}`);
    if ((input.continuationQuality ?? 0) >= T.continuationQualityMin) {
      push('continuation_quality', `continuationQuality ≥ ${T.continuationQualityMin}`, T.continuationQuality, `cq=${input.continuationQuality}`);
    }
    if (input.extended && rvol >= 2 && structure >= 55) {
      push('extended_persist', 'extended ∧ rvol≥2 ∧ structure≥55', T.extendedRvolStructure, 'extended continuation');
    }
    if (Math.abs(vwap) > T.farVwapMin) {
      push('far_vwap_penalty', `|vwap| > ${T.farVwapMin}`, T.farVwapPenalty, `|vwap|=${Math.abs(vwap).toFixed(4)}`);
    }
    return rows;
  }

  buildAccelerationContributions(input: LiveRegimeInput): FeatureContribution[] {
    const T = REGIME_THRESHOLDS.velocity;
    const rvol = input.rvol ?? 0;
    const structure = input.structureScore ?? input.trendAlignment ?? 0;
    let total = T.base;
    const rows: FeatureContribution[] = [{
      feature: 'accel_base',
      formula: 'accelerationIntegrity base',
      delta: T.base,
      runningTotal: total,
      reason: `base=${T.base}`
    }];
    const push = (feature: string, formula: string, delta: number, reason: string) => {
      total += delta;
      rows.push({ feature, formula, delta, runningTotal: total, reason });
    };
    if (rvol >= 4) push('rvol_4', 'rvol ≥ 4', T.rvol4, `rvol=${rvol.toFixed(2)}`);
    else if (rvol >= 2.5) push('rvol_2_5', 'rvol ≥ 2.5', T.rvol2_5, `rvol=${rvol.toFixed(2)}`);
    else if (rvol >= 1.8) push('rvol_1_8', 'rvol ≥ 1.8', T.rvol1_8, `rvol=${rvol.toFixed(2)}`);
    else if (rvol >= 1.3) push('rvol_1_3', 'rvol ≥ 1.3', T.rvol1_3, `rvol=${rvol.toFixed(2)}`);
    if (structure >= 70) push('structure_70', 'structure ≥ 70', T.structure70, `structure=${structure}`);
    else if (structure >= 55) push('structure_55', 'structure ≥ 55', T.structure55, `structure=${structure}`);
    else if (structure >= 45) push('structure_45', 'structure ≥ 45', T.structure45, `structure=${structure}`);
    if ((input.continuationQuality ?? 0) >= T.continuationQualityMin) {
      push('cq_accel', `continuationQuality ≥ ${T.continuationQualityMin}`, T.continuationQuality, `cq=${input.continuationQuality}`);
    }
    return rows;
  }

  buildExpansionContributions(
    persist: number,
    accel: number,
    shallow: number,
    institutional: number,
    input: LiveRegimeInput
  ): FeatureContribution[] {
    const E = REGIME_THRESHOLDS.expansion;
    let total = 0;
    const parts = [
      { feature: 'persist_weight', formula: `persist × ${E.persistWeight}`, delta: persist * E.persistWeight },
      { feature: 'accel_weight', formula: `accel × ${E.accelWeight}`, delta: accel * E.accelWeight },
      { feature: 'shallow_weight', formula: `shallow × ${E.shallowWeight}`, delta: shallow * E.shallowWeight },
      { feature: 'institutional_weight', formula: `institutional × ${E.institutionalWeight}`, delta: institutional * E.institutionalWeight }
    ];
    for (const p of parts) {
      total += p.delta;
      parts[parts.indexOf(p)] = { ...p, delta: Math.round(p.delta * 10) / 10 } as typeof p & { runningTotal?: number };
    }
    const rows: FeatureContribution[] = parts.map(p => ({
      ...p,
      runningTotal: 0,
      reason: `component=${Math.round(p.delta)}`
    }));
    let run = 0;
    for (const r of rows) {
      run += r.delta;
      r.runningTotal = Math.round(run);
    }
    if ((input.sessionTimeMinutes ?? 0) >= REGIME_THRESHOLDS.continuationWindow.startMin
      && (input.sessionTimeMinutes ?? 999) <= REGIME_THRESHOLDS.continuationWindow.endMin) {
      run += E.windowBoost;
      rows.push({ feature: 'window_boost', formula: 'in continuation window', delta: E.windowBoost, runningTotal: run, reason: `sessionMin=${input.sessionTimeMinutes}` });
    }
    if ((input.rvol ?? 0) >= E.rvolBoostMin) {
      run += E.rvolBoost;
      rows.push({ feature: 'rvol_boost', formula: `rvol ≥ ${E.rvolBoostMin}`, delta: E.rvolBoost, runningTotal: run, reason: `rvol=${input.rvol}` });
    }
    if (input.marketRegime === 'CHOP' || input.marketRegime === 'CHOPPY') {
      run += E.chopPenalty;
      rows.push({ feature: 'chop_penalty', formula: 'marketRegime CHOP', delta: E.chopPenalty, runningTotal: run, reason: input.marketRegime ?? 'CHOP' });
    }
    return rows;
  }

  /** Map metric scores → conviction proxy (0–100). */
  convictionFromMetrics(
    persist: number,
    accel: number,
    expansion: number,
    exhaustion: number
  ): { base: number; final: number; contributions: FeatureContribution[] } {
    const base = 55;
    let total = base;
    const rows: FeatureContribution[] = [{
      feature: 'conviction_base',
      formula: 'execution conviction base',
      delta: base,
      runningTotal: base,
      reason: 'base=55'
    }];
    const add = (feature: string, formula: string, delta: number, reason: string) => {
      total += delta;
      rows.push({ feature, formula, delta, runningTotal: Math.min(100, Math.max(0, Math.round(total))), reason });
    };
    if (persist >= 65) add('persist_conviction', 'continuationPersistence ≥ 65', 12, `persist=${persist}`);
    else if (persist >= 58) add('persist_conviction', 'continuationPersistence ≥ 58', 6, `persist=${persist}`);
    if (accel >= 65) add('accel_conviction', 'accelerationIntegrity ≥ 65', 10, `accel=${accel}`);
    if (expansion >= 72) add('expansion_conviction', 'expansionProbability ≥ 72', 14, `exp=${expansion}`);
    else if (expansion >= 58) add('expansion_conviction', 'expansionProbability ≥ 58', 8, `exp=${expansion}`);
    if (exhaustion >= 70) add('exhaustion_penalty', 'exhaustionProbability ≥ 70', -18, `exhaust=${exhaustion}`);
    else if (exhaustion >= 55) add('exhaustion_penalty', 'exhaustionProbability ≥ 55', -8, `exhaust=${exhaustion}`);
    return { base, final: Math.min(100, Math.max(0, Math.round(total))), contributions: rows };
  }
}
