package com.tradingbot.decisiontrace;

import java.time.Instant;

/** Phase 201 — replacement advisory vs active position. */
public record ReplacementReasoningSnapshot(
        Instant timestamp,
        String symbol,
        String regime,
        String activeSymbol,
        String activeRegime,
        String activeLifecycle,
        int incomingDominance,
        int activeDominance,
        int incomingConviction,
        int activeConviction,
        int dominanceGap,
        int convictionGap,
        String incomingVelocityTrend,
        String activeVelocityTrend,
        String marketStructure,
        String entryQuality,
        String narrative
) implements DecisionReasoningSnapshot {

    @Override
    public DecisionTraceType traceType() {
        return DecisionTraceType.REPLACEMENT;
    }
}
