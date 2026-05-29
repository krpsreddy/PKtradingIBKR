package com.tradingbot.reliability;

public record RegimeReliabilityProfile(
        String regime,
        int sampleSize,
        double winRate,
        double avgR,
        double continuationEfficiency,
        int rankingModifier,
        String fitNote
) {
    public static RegimeReliabilityProfile empty(String regime) {
        return new RegimeReliabilityProfile(regime, 0, 0, 0, 0, 0, "Insufficient sample");
    }
}
