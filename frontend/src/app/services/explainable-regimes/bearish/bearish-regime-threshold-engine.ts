/** Phase 207 — numeric bearish thresholds (downside semantics). */
export const BEARISH_REGIME_THRESHOLDS = {
  reclaim: {
    failureMin: 58,
    strongReclaimInvalidates: 72,
    weakBounceMax: 35
  },
  rejection: {
    persistenceMin: 55,
    vwapRejectDist: -0.004,
    lowerHighMin: 1
  },
  breakdown: {
    accelerationMin: 52,
    survivalMin: 50,
    downsideRvolMin: 1.35
  },
  distribution: {
    persistMin: 48,
    marketWeaknessMin: 45
  },
  squeeze: {
    lowMax: 30,
    moderateMax: 55,
    highMax: 75
  },
  put: {
    idealFollowMin: 58,
    panicChaseMax: 42
  },
  structure: {
    entryMin: 38,
    rejectionWeight: 12,
    weakReclaimWeight: 10,
    rvolWeight: 8,
    marketWeaknessWeight: 6,
    squeezePenalty: 10
  }
} as const;

export const BEARISH_REGIME_FORMULAS: Record<string, string> = {
  breakdownSurvival:
    'breakdownSurvival = rejectionPersistence×0.35 + breakdownAcceleration×0.35 + distribution×0.2 + marketWeakness×0.1',
  squeezeRiskScore:
    'squeezeRisk = exhaustionFlush×25 + weakBounce×20 + (rvol<1.2)×15 + breadthReversal×20 + volCompression×20',
  structureScore:
    'structure = rejection + weakReclaim + downsideRvol + marketWeakness − squeezePenalty',
  breakdownProbability:
    'breakdownProb = clamp(breakdownSurvival − squeezeRisk×0.35, 0, 100)',
  putFollowThrough:
    'putFollow = breakdownProb×0.6 + rejectionPersistence×0.25 − squeezeRisk×0.15'
};
