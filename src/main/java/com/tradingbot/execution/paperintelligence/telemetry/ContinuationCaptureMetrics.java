package com.tradingbot.execution.paperintelligence.telemetry;

public record ContinuationCaptureMetrics(
        double captureRatio,
        double exitEfficiency,
        double trailingEfficiency,
        boolean continuationSurvival,
        boolean prematureExit,
        boolean overstayed,
        double slippagePenalty,
        int executionScore,
        String insight
) {}
