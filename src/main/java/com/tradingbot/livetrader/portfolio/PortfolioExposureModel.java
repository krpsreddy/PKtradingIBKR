package com.tradingbot.livetrader.portfolio;

import java.math.BigDecimal;
import java.time.Instant;

/** Phase 189 — snapshot of the single active paper slot (max 1). */
public record PortfolioExposureModel(
        boolean hasActive,
        String symbol,
        String regime,
        String sectorCluster,
        int dominance,
        int conviction,
        String lifecycle,
        String velocityTrend,
        BigDecimal unrealizedR,
        BigDecimal mfeR,
        BigDecimal maeR,
        Integer holdDurationSec,
        Instant openedAt,
        Long paperExecutionId
) {
    public static PortfolioExposureModel empty() {
        return new PortfolioExposureModel(
                false, null, null, null, 0, 0, null, null,
                null, null, null, null, null, null
        );
    }
}
