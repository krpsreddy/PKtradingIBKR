package com.tradingbot.decisiontrace;

import java.time.Instant;
import java.util.List;

/** Phase 202 — persisted bearish PUT assist reasoning. */
public record BearishReasoningSnapshot(
        Instant timestamp,
        String symbol,
        String regime,
        int bearishBias,
        String bearishState,
        String breakdownProbability,
        String confidence,
        boolean active,
        List<String> reasons,
        List<String> blockReasons,
        String marketStructure,
        String narrative
) implements DecisionReasoningSnapshot {

    @Override
    public DecisionTraceType traceType() {
        return DecisionTraceType.PUT_ASSIST;
    }
}
