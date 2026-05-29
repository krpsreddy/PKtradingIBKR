package com.tradingbot.decisiontrace;

import java.time.Instant;
import java.util.List;

/** Phase 201 — full context at auto paper entry. */
public record EntryReasoningSnapshot(
        Instant timestamp,
        String symbol,
        String regime,
        String marketStructure,
        String lifecycle,
        String entryQuality,
        int conviction,
        int dominance,
        int persistence,
        int velocity,
        String velocityTrend,
        double rvol,
        String vwapRelation,
        String emaAlignment,
        String sectorStrength,
        String breadth,
        int reliabilityScore,
        String executionQuality,
        String orchestrationState,
        Integer queueRank,
        String replacementCandidate,
        String sessionPhase,
        int continuationProbability,
        int secondLegProbability,
        int exhaustionScore,
        List<String> whyNow,
        int adjustedConviction,
        int adjustedDominance,
        String narrative
) implements DecisionReasoningSnapshot {

    @Override
    public DecisionTraceType traceType() {
        return DecisionTraceType.ENTRY;
    }
}
