package com.tradingbot.sessionintelligence.premarket;

/** Phase 211 — summarized premarket intelligence (9:00–9:30 ET). */
public record PremarketSnapshotDto(
        String symbol,
        double premarketGapPct,
        double premarketHigh,
        double premarketLow,
        double premarketVWAP,
        double premarketRVOL,
        int premarketTrendQuality,
        int premarketPersistence,
        int premarketAcceleration,
        String premarketBreakoutState,
        boolean premarketReclaimFailure,
        boolean premarketDistribution,
        String premarketDirectionBias,
        int premarketQualityScore,
        int openingContinuationProbability,
        int squeezeRisk,
        PremarketTrendState trendState,
        String operationalChip,
        long timestamp
) {
    public static PremarketSnapshotDto empty(String symbol) {
        return new PremarketSnapshotDto(
                symbol, 0, 0, 0, 0, 1, 0, 0, 0,
                "NONE", false, false, "NEUTRAL", 0, 0, 0,
                PremarketTrendState.WEAK_DRIFT, null, System.currentTimeMillis());
    }
}
