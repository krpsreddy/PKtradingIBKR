package com.tradingbot.execution.paperintelligence.simulation;

import com.tradingbot.execution.paperintelligence.ExecutionDeteriorationState;
import com.tradingbot.execution.paperintelligence.entry.EntryExecutionPlan;
import com.tradingbot.execution.paperintelligence.stop.StructuralStopPlan;
import com.tradingbot.execution.paperintelligence.trailing.TrailingStopPlan;

import java.math.BigDecimal;

/** In-memory open-position execution intelligence (paper). */
public record PaperExecutionIntelligenceState(
        Long paperExecutionId,
        EntryExecutionPlan entryPlan,
        StructuralStopPlan initialStop,
        TrailingStopPlan lastTrail,
        ExecutionDeteriorationState deterioration,
        BigDecimal unrealizedPeakR
) {}
