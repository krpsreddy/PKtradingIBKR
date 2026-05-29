package com.tradingbot.tradingview.dto;

public record TradingViewWebhookResultDto(
        boolean accepted,
        String symbol,
        String reason
) {}
