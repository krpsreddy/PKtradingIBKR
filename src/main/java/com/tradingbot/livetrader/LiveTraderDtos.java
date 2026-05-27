package com.tradingbot.livetrader;

import com.tradingbot.api.dto.PaperExecutionDtos;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.MarketHeartbeatDto;
import com.tradingbot.intelligence.execution.realtime.dto.RealTimeExecutionDtos.ExecutionFeedItemDto;
import com.tradingbot.paper.PaperExecutionMode;

import java.math.BigDecimal;
import java.util.List;

public final class LiveTraderDtos {

    private LiveTraderDtos() {}

    public record RuntimeControlsDto(
            boolean scanningEnabled,
            boolean telegramEnabled,
            boolean autoExecutionEnabled,
            PaperExecutionMode executionMode
    ) {}

    public record SetRuntimeControlsRequest(
            Boolean scanningEnabled,
            Boolean telegramEnabled,
            Boolean autoExecutionEnabled,
            PaperExecutionMode executionMode
    ) {}

    public record RankedOpportunityDto(
            String symbol,
            String regime,
            String action,
            String tone,
            String badge,
            String maturityState,
            int conviction,
            int convictionVelocity,
            int persistenceSeconds,
            int institutionalPressure,
            int expansionProbability,
            int dominanceScore,
            List<String> whyNow,
            String entryZoneLabel,
            String riskLabel,
            boolean emergingFast,
            boolean degrading,
            long updatedAt
    ) {}

    public record Tier1SnapshotDto(
            RankedOpportunityDto dominant,
            List<RankedOpportunityDto> topRanked,
            List<RankedOpportunityDto> degrading,
            long generatedAt,
            int feedGeneration
    ) {}

    public record PnlSummaryDto(
            BigDecimal unrealizedSumR,
            BigDecimal realizedSumR,
            int openPositions,
            int closedToday,
            BigDecimal avgRealizedR,
            int continuationCaptures
    ) {}

    public record LiveTraderSnapshotDto(
            Tier1SnapshotDto tier1,
            MarketHeartbeatDto market,
            PaperExecutionDtos.ExecutionStatusDto paperStatus,
            List<PaperExecutionDtos.PaperExecutionRecordDto> activePositions,
            PnlSummaryDto pnl,
            List<String> advisories,
            RuntimeControlsDto runtime
    ) {}

    public record TelegramTickResultDto(
            boolean sent,
            String alertType,
            String symbol,
            String reason
    ) {}
}
