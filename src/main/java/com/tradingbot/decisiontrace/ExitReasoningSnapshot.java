package com.tradingbot.decisiontrace;

import java.time.Instant;

/** Phase 201 — full context at adaptive exit. */
public record ExitReasoningSnapshot(
        Instant timestamp,
        String symbol,
        String regime,
        String exitState,
        int persistenceAtExit,
        int persistenceAtEntry,
        int dominanceAtExit,
        int velocityAtExit,
        String velocityTrend,
        int exhaustionScore,
        boolean vwapFailure,
        int secondLegProbability,
        int continuationDeterioration,
        String marketStructureShift,
        Double realizedR,
        Double continuationCapturePct,
        Integer holdDurationSec,
        Double mfeR,
        Double maeR,
        String trendQualityNote,
        String narrative
) implements DecisionReasoningSnapshot {

    @Override
    public DecisionTraceType traceType() {
        return DecisionTraceType.EXIT;
    }
}
