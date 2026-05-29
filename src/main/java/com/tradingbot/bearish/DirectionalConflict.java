package com.tradingbot.bearish;

/** Phase 209 — bullish vs bearish structural conflict. */
public enum DirectionalConflict {
    NONE,
    LOW,
    MODERATE,
    HIGH;

    public boolean suppressesAutoExecution() {
        return this == HIGH;
    }
}
