package com.tradingbot.execution.paperintelligence.fills;

import com.tradingbot.execution.paperintelligence.FillQuality;

import java.math.BigDecimal;

public record PaperFillResult(
        boolean filled,
        boolean partialFill,
        BigDecimal avgFillPrice,
        long fillLatencyMs,
        FillQuality fillQuality,
        BigDecimal slippagePct,
        String missReason
) {
    public static PaperFillResult missed(String reason) {
        return new PaperFillResult(false, false, null, 0, FillQuality.MISSED, BigDecimal.ZERO, reason);
    }
}
