package com.tradingbot.broker.model;

public record BrokerConnectionStatusDto(
        String status,
        BrokerConnectionPhase phase,
        String mode,
        String profile,
        String profileId,
        String host,
        int port,
        int clientId,
        boolean connected,
        boolean ready,
        boolean streaming,
        Long latencyMs,
        int subscriptionCount,
        String message,
        long updatedAt
) {}
