package com.tradingbot.executionintelligence;

import com.tradingbot.entry.EntryQualityAssessment;
import com.tradingbot.entry.EntryQualityState;
import com.tradingbot.marketstructure.MarketStructureAssessment;

public record OpportunityIntelligenceSnapshot(
        MarketStructureAssessment marketStructure,
        EntryQualityAssessment entryQuality,
        int adjustedDominance,
        int adjustedConviction,
        boolean autoEntryAllowed,
        String blockReason
) {
    public static OpportunityIntelligenceSnapshot blocked(String reason) {
        return new OpportunityIntelligenceSnapshot(
                MarketStructureAssessment.neutral(),
                new EntryQualityAssessment(EntryQualityState.WEAK_STRUCTURE, 0, false, reason),
                0,
                0,
                false,
                reason
        );
    }
}
