package com.tradingbot.dataintegrity.integrity;

/** Phase 212 — live runtime data trust state. */
public enum RuntimeIntegrityState {
    LIVE,
    DELAYED,
    STALE,
    DEGRADED,
    RECOVERING,
    DISCONNECTED;

    public boolean allowsExecution() {
        return this == LIVE || this == DELAYED;
    }

    public boolean freezeRegimeMutation() {
        return this == DEGRADED || this == RECOVERING || this == DISCONNECTED || this == STALE;
    }

    /** Blocks auto execution, lifecycle transitions, adaptive exits, queue promotion. */
    public boolean blocksRecoverySensitiveOps() {
        return this == STALE || this == DEGRADED || this == RECOVERING || this == DISCONNECTED;
    }
}
