package com.tradingbot.execution.paperintelligence.trailing;

import java.math.BigDecimal;

public record TrailingStopPlan(
        BigDecimal trailingStop,
        int stopTightness,
        String structuralReason,
        String deteriorationAdjustment
) {}
