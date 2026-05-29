package com.tradingbot.marketstructure;

import java.util.List;

public record MarketStructureAssessment(
        MarketEnvironmentState primary,
        List<MarketEnvironmentState> tags,
        int continuationModifier,
        int convictionCap,
        boolean blockAggressiveBreakout,
        boolean boostContinuation,
        String summary
) {
    public static MarketStructureAssessment neutral() {
        return new MarketStructureAssessment(
                MarketEnvironmentState.MIDDAY_DRIFT,
                List.of(),
                0,
                100,
                false,
                false,
                "Neutral structure"
        );
    }
}
