package com.tradingbot.exit;

/** Phase 198 — adaptive continuation exit guidance. */
public enum ExitState {
    HOLD,
    TRAIL,
    SECOND_LEG_ACTIVE,
    REDUCE_RISK,
    EXIT_WARNING,
    EXIT_CRITICAL,
    PERSISTENCE_FAILURE,
    EXHAUSTION_EXIT,
    VWAP_FAILURE
}
