package com.tradingbot.ibkr.stream;

/** Phase 194 — why a symbol holds its current stream tier. */
public enum StreamAllocationReason {
    ACTIVE_POSITION,
    DOMINANT,
    EMERGING,
    QUEUE,
    REPLACEMENT,
    SCAN_TOP,
    PINNED,
    LOW_PRIORITY,
    EXHAUSTED,
    DORMANT_IDLE,
    MANUAL
}
