package com.tradingbot.execution.paperintelligence.stop;

import com.tradingbot.execution.paperintelligence.StopType;

import java.math.BigDecimal;

public record StructuralStopPlan(
        BigDecimal stopPrice,
        StopType stopType,
        BigDecimal riskDistance,
        String invalidationReason
) {}
