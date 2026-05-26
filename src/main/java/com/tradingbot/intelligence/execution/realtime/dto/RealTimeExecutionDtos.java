package com.tradingbot.intelligence.execution.realtime.dto;

import java.util.List;

/** Phase 167 — real-time execution feed DTOs. */
public final class RealTimeExecutionDtos {

    private RealTimeExecutionDtos() {}

    public record ConfidencePointDto(long timestamp, int conviction) {}

    public record ExecutionFeedItemDto(
            String symbol,
            String opportunityType,
            String action,
            String tone,
            String badge,
            String maturityState,
            String executionMode,
            boolean preConfirmation,
            int conviction,
            int convictionVelocity,
            int expansionProbability,
            int triggerIntegrity,
            int persistenceSeconds,
            List<String> whyNow,
            String entryZoneLabel,
            String riskLabel,
            List<ConfidencePointDto> confidenceTimeline,
            long updatedAt
    ) {}

    public record ExecutionFeedSnapshotDto(
            boolean advisoryOnly,
            long generatedAt,
            int symbolCount,
            int nanoScanGeneration,
            List<ExecutionFeedItemDto> feed,
            List<String> summaryInsights
    ) {}
}
