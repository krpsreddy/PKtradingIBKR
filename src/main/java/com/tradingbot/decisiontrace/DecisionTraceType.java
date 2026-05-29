package com.tradingbot.decisiontrace;

/** Phase 201 — classification of persisted execution reasoning. */
public enum DecisionTraceType {
    ENTRY,
    EXIT,
    REJECTION,
    SUPPRESSION,
    QUEUE,
    REPLACEMENT,
    PUT_ASSIST
}
