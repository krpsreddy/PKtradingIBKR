package com.tradingbot.livetrader.execution;

/** Phase 188 — post-setup trade lifecycle (mobile ribbon). */
public enum TradeLifecyclePhase {
    DEVELOPING,
    CONFIRMED,
    PERSISTING,
    SECOND_LEG,
    EXTENDED,
    EXHAUSTING,
    FAILED;

    public static final TradeLifecyclePhase[] RIBBON_ORDER = {
            DEVELOPING, CONFIRMED, PERSISTING, SECOND_LEG, EXTENDED, EXHAUSTING, FAILED
    };
}
