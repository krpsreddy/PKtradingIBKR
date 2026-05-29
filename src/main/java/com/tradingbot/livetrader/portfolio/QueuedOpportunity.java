package com.tradingbot.livetrader.portfolio;

import java.time.Instant;

/** In-memory queued / classified opportunity for orchestration UI. */
public record QueuedOpportunity(
        String symbol,
        String regime,
        OrchestrationState state,
        String reason,
        int conviction,
        int dominance,
        int persistence,
        double rvol,
        String executionQuality,
        String tradeLifecycle,
        String velocityTrend,
        boolean marketAligned,
        String sectorCluster,
        Instant queuedAt,
        long updatedAt
) {}
