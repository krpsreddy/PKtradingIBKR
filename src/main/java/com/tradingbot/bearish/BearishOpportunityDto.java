package com.tradingbot.bearish;

import java.util.List;

/** Phase 209 — ranked bearish opportunity for manual PUT workflow. */
public record BearishOpportunityDto(
        String symbol,
        String bearishRegime,
        String breakdownQuality,
        int bearishBias,
        int continuationProbability,
        int squeezeRisk,
        BullishDeteriorationLevel deteriorationLevel,
        PutAssistGrade putGrade,
        String narrative,
        List<String> reasons
) {}
