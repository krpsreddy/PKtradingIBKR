package com.tradingbot.broker.model;

/** Configurable broker endpoint (IBKR today; extensible to Polygon/Finnhub). */
public record BrokerProfile(
        String id,
        String name,
        String host,
        int port,
        int clientId,
        BrokerMode mode,
        boolean enabled,
        boolean autoReconnect,
        String adapterType
) {
    public BrokerProfile {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("profile id required");
        }
        if (adapterType == null || adapterType.isBlank()) {
            adapterType = "IBKR";
        }
    }
}
