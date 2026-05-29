package com.tradingbot.decisiontrace;

import java.time.Instant;

/** Phase 201 — common marker for structured reasoning payloads. */
public interface DecisionReasoningSnapshot {

    DecisionTraceType traceType();

    Instant timestamp();

    String symbol();

    String regime();
}
