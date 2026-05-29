package com.tradingbot.livetrader.portfolio;

/** Phase 189 — opportunity slot state in portfolio orchestration. */
public enum OrchestrationState {
    ACTIVE,
    QUEUE,
    SUPPRESSED,
    REPLACEMENT_CANDIDATE,
    REJECTED_CORRELATION,
    REJECTED_QUALITY,
    REJECTED_MARKET,
    EXPIRED
}
