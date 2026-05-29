package com.tradingbot.bearish;

/** Phase 209 — long entry suppression from bearish structure. */
public enum LongSuppressionLevel {
    NONE,
    WARNING,
    DOWNGRADE,
    BLOCK;

    public boolean blocksAutoExecution() {
        return this == BLOCK;
    }
}
