package com.tradingbot.sessionintelligence.premarket;

/** Phase 211 — premarket structural classification. */
public enum PremarketTrendState {
    HEALTHY_CONTINUATION,
    EARLY_EXPANSION,
    PARABOLIC_EXTENSION,
    FAILED_GAP,
    DISTRIBUTION,
    WEAK_DRIFT,
    RECLAIM_FAILURE,
    PM_BREAKDOWN
}
