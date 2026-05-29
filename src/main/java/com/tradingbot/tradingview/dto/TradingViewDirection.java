package com.tradingbot.tradingview.dto;

public enum TradingViewDirection {
    BULLISH,
    BEARISH,
    NEUTRAL;

    public static TradingViewDirection parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return NEUTRAL;
        }
        String u = raw.trim().toUpperCase();
        if (u.contains("BEAR") || u.contains("PUT") || u.contains("SHORT")) {
            return BEARISH;
        }
        if (u.contains("BULL") || u.contains("LONG")) {
            return BULLISH;
        }
        return NEUTRAL;
    }
}
