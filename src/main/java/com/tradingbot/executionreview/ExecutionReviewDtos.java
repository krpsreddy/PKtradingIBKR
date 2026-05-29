package com.tradingbot.executionreview;

import java.math.BigDecimal;
import java.util.List;

/** Phase 190 — execution review workspace API contracts. */
public final class ExecutionReviewDtos {

    private ExecutionReviewDtos() {}

    public record DailySummaryDto(
            int totalTrades,
            int closedTrades,
            int openTrades,
            double winRate,
            BigDecimal realizedPnlR,
            BigDecimal expectancyR,
            BigDecimal avgR,
            double continuationCapturePct,
            String bestRegime,
            String worstRegime,
            double queueMissScore,
            String sessionDate
    ) {}

    public record TradeReviewDto(
            Long telemetryId,
            Long paperExecutionId,
            String symbol,
            String regime,
            int conviction,
            int dominance,
            int persistence,
            String lifecycle,
            String executionQuality,
            String entryQuality,
            String exitQuality,
            BigDecimal mfeR,
            BigDecimal maeR,
            BigDecimal realizedR,
            double continuationCapturePct,
            Integer holdDurationSec,
            String outcome,
            String exitReason,
            String sessionPeriod,
            String marketRegime,
            long openedAtMs,
            Long closedAtMs,
            String narrative,
            List<TimelineEventDto> timeline,
            ReplayLaunchDto replay
    ) {}

    public record TimelineEventDto(
            String phase,
            long timestampMs,
            Integer dominance,
            Integer persistence,
            Integer velocity,
            String lifecycle,
            String note
    ) {}

    public record ReplayLaunchDto(
            String signalId,
            String symbol,
            String sessionDate,
            long timestampMs,
            int replayIndex
    ) {}

    public record RegimePerformanceDto(
            String regime,
            int tradeCount,
            double winRate,
            BigDecimal expectancyR,
            BigDecimal avgHoldSec,
            double continuationCapturePct,
            double persistenceSurvivalPct,
            double secondLegSuccessPct,
            String bestSession
    ) {}

    public record ContinuationCaptureDto(
            Long telemetryId,
            String symbol,
            BigDecimal mfeR,
            BigDecimal realizedR,
            double capturePct,
            double mfeCapturePct,
            double secondLegCapturePct,
            double persistenceMonetizationPct,
            double trailEfficiencyPct
    ) {}

    public record QueueAnalysisItemDto(
            String symbol,
            String regime,
            String orchestrationState,
            String reason,
            String activeSymbol,
            int dominance,
            int conviction,
            long recordedAtMs,
            String verdict,
            String note,
            BigDecimal hypotheticalDeltaR
    ) {}

    public record QueueAnalysisDto(
            List<QueueAnalysisItemDto> queuedVsActive,
            List<QueueAnalysisItemDto> suppressions,
            List<QueueAnalysisItemDto> replacementAdvisories,
            int correctSuppressions,
            int queueOutperformedActive
    ) {}

    public record SessionAnalysisDto(
            String sessionPeriod,
            int trades,
            double winRate,
            BigDecimal avgR,
            double continuationCapturePct,
            String marketContext
    ) {}

    public record TradesResponseDto(
            List<TradeReviewDto> trades,
            TradeFiltersDto appliedFilters
    ) {}

    public record TradeFiltersDto(
            String regime,
            String lifecycle,
            String outcome,
            String symbol,
            String sessionPeriod,
            String entryQuality,
            String exitQuality
    ) {}
}
