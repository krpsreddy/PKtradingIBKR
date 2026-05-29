package com.tradingbot.bearishassist;

/**
 * Phase 202 — trading assist scope (no autonomous short execution).
 * Future: {@link #FULL_SHORT_EXECUTION} reserved, not implemented.
 */
public enum BearishAssistMode {
    LONG_ONLY,
    LONG_PLUS_PUT_ASSIST,
    /** Reserved — do not enable until explicit short-execution phase. */
    FULL_SHORT_EXECUTION
}
