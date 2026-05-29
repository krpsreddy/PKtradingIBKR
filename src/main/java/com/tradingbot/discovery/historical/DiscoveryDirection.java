package com.tradingbot.discovery.historical;

/** Phase 206 — separates bullish continuation from bearish breakdown research. */
public enum DiscoveryDirection {
    BULLISH,
    BEARISH;

    public String apiSlug() {
        return name().toLowerCase();
    }
}
