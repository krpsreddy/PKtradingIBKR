package com.tradingbot.api.dto;

import java.math.BigDecimal;

/** Phase 181 — standardized 1-share paper research probe. */
public record PaperProbeRequest(
        String symbol,
        String regime,
        String planSource,
        BigDecimal entryPrice,
        Integer convictionScore,
        Integer dominanceScore,
        Integer executionQuality
) {}
