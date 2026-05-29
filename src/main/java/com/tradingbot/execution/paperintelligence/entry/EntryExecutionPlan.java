package com.tradingbot.execution.paperintelligence.entry;

import java.math.BigDecimal;

/** Phase 210 — adaptive limit entry plan (simulated). */
public record EntryExecutionPlan(
        BigDecimal limitPrice,
        BigDecimal entryOffset,
        int fillProbability,
        int slippageRisk,
        int staleAfterSeconds,
        String entryStyle,
        String narrative
) {}
