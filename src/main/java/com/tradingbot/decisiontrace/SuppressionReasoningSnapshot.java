package com.tradingbot.decisiontrace;

import java.time.Instant;

/** Phase 201 — rejected or suppressed opportunity (filter validation). */
public record SuppressionReasoningSnapshot(
        Instant timestamp,
        String symbol,
        String regime,
        DecisionTraceType traceType,
        String orchestrationState,
        String rejectionCategory,
        String marketStructure,
        String entryQuality,
        String lifecycle,
        int conviction,
        int dominance,
        int persistence,
        double rvol,
        int reliabilityModifier,
        boolean macroAllowed,
        boolean autoEntryAllowed,
        String activeSymbol,
        String correlationNote,
        Integer dominanceGap,
        String narrative
) implements DecisionReasoningSnapshot {

    public SuppressionReasoningSnapshot {
        if (traceType != DecisionTraceType.REJECTION
                && traceType != DecisionTraceType.SUPPRESSION
                && traceType != DecisionTraceType.QUEUE) {
            throw new IllegalArgumentException("traceType must be REJECTION, SUPPRESSION, or QUEUE");
        }
    }
}
