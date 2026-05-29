package com.tradingbot.tradingview.dto;

import java.util.List;

/** Phase 217 — operational TV intelligence feed for PK Live Trader. */
public record TradingViewFeedDto(
        long generatedAtMs,
        TradingViewHealthDto health,
        List<TradingViewSignalDto> topBullish,
        List<TradingViewSignalDto> topBearish,
        List<TradingViewSignalDto> topPutAssist,
        List<TradingViewSignalDto> highPersistence,
        List<TradingViewSignalDto> strongestContinuation,
        List<TradingViewSignalDto> highConflict,
        List<TradingViewSignalDto> collapsing
) {}
