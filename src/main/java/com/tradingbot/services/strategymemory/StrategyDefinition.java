package com.tradingbot.services.strategymemory;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Map;

/** Canonical autonomous strategy definition persisted as JSON. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record StrategyDefinition(
        String strategyId,
        String strategyName,
        String category,
        List<String> conditions,
        Map<String, Object> thresholds,
        double winRate,
        double avgR,
        double robustness,
        boolean active,
        boolean deprecated,
        List<String> replayExamples,
        int discoveredFromPhase,
        String notes,
        int version,
        List<String> governanceTags
) {}
