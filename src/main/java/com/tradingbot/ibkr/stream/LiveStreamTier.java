package com.tradingbot.ibkr.stream;

/** Phase 194 — runtime market-data allocation tier (not a DB flag). */
public enum LiveStreamTier {
    REALTIME,
    SNAPSHOT,
    DORMANT,
    QUEUED_FOR_PROMOTION,
    PENDING_UNSUBSCRIBE
}
