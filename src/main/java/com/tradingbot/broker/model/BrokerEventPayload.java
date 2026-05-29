package com.tradingbot.broker.model;

public record BrokerEventPayload(
        BrokerEventType event,
        BrokerConnectionStatusDto status,
        long timestamp
) {}
