package com.tradingbot.analytics.storage.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

public final class AnalyticsStorageDtos {
    private AnalyticsStorageDtos() {}

    public record AnalyticsVersionDto(
            int currentVersion,
            long evaluatedSnapshotCount,
            long playbookCandidateCount,
            boolean stale
    ) {}

    public record BulkUpsertResultDto(
            int upserted,
            int skipped,
            int analyticsVersion
    ) {}

    public record EvaluatedSnapshotPageDto(
            List<JsonNode> signals,
            int page,
            int size,
            long totalElements,
            int analyticsVersion,
            boolean authoritative
    ) {}

    public record HydrationSessionDto(
            String symbol,
            Integer lookbackDays,
            Integer candlesLoaded,
            Integer signalsEvaluated,
            String status,
            List<String> evaluatedSessionDates,
            Integer analyticsVersion,
            String startedAt,
            String completedAt,
            boolean stale
    ) {}

    public record PlaybookCandidatePersistDto(
            String candidateId,
            String candidateKey,
            JsonNode payload,
            Integer analyticsVersion
    ) {}

    public record DecisionFeedbackPersistDto(
            String signalId,
            JsonNode payload,
            Integer analyticsVersion
    ) {}

    public record StorageStatsDto(
            long evaluatedSnapshots,
            long hydrationSessions,
            long playbookCandidates,
            long decisionFeedbackRows,
            int analyticsVersion
    ) {}

    public record BulkSnapshotRequest(
            List<JsonNode> signals,
            Integer analyticsVersion
    ) {}

    public record HistoricalSignalSearchResultDto(
            String signalId,
            String symbol,
            String sessionDate,
            String timestamp,
            long timestampMs,
            String decision,
            String narrative,
            Integer conviction,
            Double expectancy,
            Double actualR,
            Double fakeoutRisk,
            String entryQuality,
            boolean replayReady,
            int replayIndex,
            String snapshotId
    ) {}

    public record HistoricalSignalSearchPageDto(
            List<HistoricalSignalSearchResultDto> signals,
            int page,
            int size,
            long totalElements,
            int analyticsVersion
    ) {}
}
