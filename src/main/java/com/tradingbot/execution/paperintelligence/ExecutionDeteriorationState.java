package com.tradingbot.execution.paperintelligence;

/** Phase 210 — execution lifecycle deterioration (paper). */
public enum ExecutionDeteriorationState {
    HEALTHY,
    SOFTENING,
    DETERIORATING,
    COLLAPSING;

    public boolean tightensTrail() {
        return ordinal() >= SOFTENING.ordinal();
    }

    public boolean forcesExit() {
        return this == COLLAPSING;
    }
}
