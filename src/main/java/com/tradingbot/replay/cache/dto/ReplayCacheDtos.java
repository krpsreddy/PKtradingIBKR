package com.tradingbot.replay.cache.dto;

import com.tradingbot.api.dto.ReplayHistoryDto;

import java.util.List;

public final class ReplayCacheDtos {
    private ReplayCacheDtos() {}

    public record ReplaySnapshotSummaryDto(
            String symbol,
            String sessionDate,
            int analyticsVersion,
            String candlesHash,
            String replayStatus,
            int totalBars,
            int simulatedSignals,
            boolean stale
    ) {}

    public record SymbolSnapshotPageDto(
            String symbol,
            int analyticsVersion,
            int totalSessions,
            int readySessions,
            int staleSessions,
            int missingSessions,
            List<ReplaySnapshotSummaryDto> sessions
    ) {}

    public record StaleSessionsDto(
            String symbol,
            int analyticsVersion,
            List<String> staleDates,
            List<String> missingDates,
            int readyCount
    ) {}

    public record IncrementalReplayResultDto(
            String symbol,
            int lookbackDays,
            int sessionsProcessed,
            int sessionsFromCache,
            int sessionsReplayed,
            int sessionsWithSignals,
            int totalSignals,
            int candlesStored,
            String historyStatus,
            String historyMessage,
            List<ReplayHistoryDto> sessions
    ) {}

    public record BulkSnapshotPersistResultDto(
            int upserted,
            int skipped,
            int analyticsVersion
    ) {}

    public record SessionSummaryDto(
            String sessionDate,
            int signalCount,
            Double convictionAvg,
            boolean replayReady,
            boolean stale,
            String bestDecision,
            String bestNarrative,
            Double expectancy,
            String status
    ) {}

    /** Phase 155 — compact signal index row (no replay payload). */
    public record ReplaySignalIndexRowDto(
            String signalId,
            String symbol,
            String sessionDate,
            long timestamp,
            String timestampIso,
            int replayIndex,
            int candleIndex,
            String decision,
            String setup,
            String narrative,
            Integer conviction,
            String entryQuality,
            Double resultR,
            Double mfe,
            Double mae,
            boolean replayReady,
            String replaySnapshotId,
            String winLoss,
            String lifecycleState,
            List<String> journeySteps
    ) {}

    public record ReplaySignalIndexPageDto(
            List<ReplaySignalIndexRowDto> rows,
            long total,
            int page,
            int size,
            long generatedAt,
            int analyticsVersion
    ) {}
}
