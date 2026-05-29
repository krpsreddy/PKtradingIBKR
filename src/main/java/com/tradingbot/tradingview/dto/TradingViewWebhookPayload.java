package com.tradingbot.tradingview.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Phase 217 — Pine alert webhook body (flexible fields). */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TradingViewWebhookPayload(
        String symbol,
        String direction,
        Integer dominance,
        Integer conviction,
        Integer persistence,
        Double rvol,
        String lifecycle,
        String regime,
        String putGrade,
        Integer bearishBias,
        String executionQuality,
        String deterioration,
        String conflictLevel,
        String pmState,
        Long timestamp
) {}
