package com.tradingbot.broker.registry;

public record SubscriptionRecord(
        String symbol,
        int tickerId,
        SubscriptionType type
) {}
