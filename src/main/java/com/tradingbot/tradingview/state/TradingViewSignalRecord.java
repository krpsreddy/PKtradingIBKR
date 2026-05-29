package com.tradingbot.tradingview.state;

import com.tradingbot.tradingview.dto.TradingViewDirection;
import com.tradingbot.tradingview.dto.TradingViewSignalDto;

/** Internal stored TV signal with freshness metadata. */
public record TradingViewSignalRecord(
        String key,
        TradingViewSignalDto signal,
        long lastUpdatedMs
) {
    public static String keyFor(String symbol, TradingViewDirection direction) {
        return symbol.toUpperCase() + "|" + direction.name();
    }
}
