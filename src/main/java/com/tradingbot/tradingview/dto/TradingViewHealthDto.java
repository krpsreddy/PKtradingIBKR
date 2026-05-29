package com.tradingbot.tradingview.dto;

/** Phase 217 — TV signal pipeline health. */
public record TradingViewHealthDto(
        long lastSignalAtMs,
        int activeSignals,
        int staleSignals,
        int dedupedLastHour,
        boolean healthy
) {}
