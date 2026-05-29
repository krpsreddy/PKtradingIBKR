package com.tradingbot.bearishassist;

/** Phase 202 — bearish structure lifecycle (not inverted bullish states). */
public enum BearishBiasState {
    EARLY_WEAKNESS,
    FAILED_RECLAIM,
    VWAP_REJECTION,
    DISTRIBUTION,
    BREAKDOWN_CONFIRMATION,
    ACCELERATED_SELLING,
    PANIC_EXPANSION,
    EXHAUSTION_BOUNCE
}
