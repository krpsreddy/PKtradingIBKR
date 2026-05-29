package com.tradingbot.ibkr.stream;

/**
 * Phase 194 — desired stream allocation for one symbol.
 *
 * @param priorityScore higher wins realtime slots
 */
public record SymbolStreamAllocation(
        String symbol,
        LiveStreamTier tier,
        StreamAllocationReason reason,
        int priorityScore,
        int dominanceScore,
        String lifecycle,
        boolean ibkrSubscribed
) {}
