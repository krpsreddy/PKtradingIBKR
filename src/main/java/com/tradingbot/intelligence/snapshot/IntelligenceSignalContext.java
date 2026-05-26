package com.tradingbot.intelligence.snapshot;

/** Normalized signal context for intelligence scoring. */
public record IntelligenceSignalContext(
        String signalId,
        String symbol,
        String sessionDate,
        long timestampMs,
        int barIndex,
        String marketRegime,
        String signalType,
        Double rvol,
        Double vwapDistance,
        Double trendAlignment,
        Double convictionScore,
        Boolean extended,
        Double volatility,
        Double entryPrice,
        Integer sessionTimeMinutes,
        double mfeR
) {}
