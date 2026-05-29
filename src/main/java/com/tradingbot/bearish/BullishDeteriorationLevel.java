package com.tradingbot.bearish;

/** Phase 209 — bullish continuation weakening into bearish pressure. */
public enum BullishDeteriorationLevel {
    HEALTHY,
    WARNING,
    DETERIORATING,
    COLLAPSING;

    public boolean tightensExits() {
        return ordinal() >= WARNING.ordinal();
    }

    public boolean forcesDefensiveExit() {
        return this == COLLAPSING;
    }
}
