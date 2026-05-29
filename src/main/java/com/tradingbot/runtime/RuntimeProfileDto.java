package com.tradingbot.runtime;

public record RuntimeProfileDto(
        String runtime,
        String executionMode,
        int port,
        int ibkrPort,
        String integrityMode,
        String brokerType,
        boolean autoPaperEnabled,
        boolean liveExecutionEnabled
) {}
