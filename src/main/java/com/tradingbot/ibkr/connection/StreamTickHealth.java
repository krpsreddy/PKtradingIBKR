package com.tradingbot.ibkr.connection;

/** Per-symbol tick freshness (Phase 216). */
public enum StreamTickHealth {
    PENDING,
    LIVE,
    DEGRADED,
    STALE,
    DEAD
}
