package com.tradingbot.api.dto;

import com.tradingbot.models.PaperExecutionRecord;
import com.tradingbot.paper.IbkrGatewayMode;
import com.tradingbot.paper.PaperExecutionMode;
import com.tradingbot.paper.PaperExecutionStatus;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class PaperExecutionDtos {

    private PaperExecutionDtos() {}

    @Value
    @Builder
    public static class ExecutionStatusDto {
        PaperExecutionMode mode;
        boolean researchInfrastructureEnabled;
        IbkrGatewayMode gatewayMode;
        int configuredIbkrPort;
        int paperPort;
        int livePort;
        boolean ibkrConnected;
        boolean ibkrReadyForOrders;
        SafetyDto safety;
    }

    @Value
    @Builder
    public static class SafetyDto {
        boolean allowed;
        String reason;
        IbkrGatewayMode gateway;
    }

    public record SetModeRequest(PaperExecutionMode mode) {}

    public record ManualCloseRequest(BigDecimal exitPrice) {}

    @Value
    @Builder
    public static class PaperExecutionRecordDto {
        Long id;
        String symbol;
        String regime;
        PaperExecutionMode executionMode;
        PaperExecutionStatus status;
        String planSource;
        BigDecimal entryPrice;
        BigDecimal fillPrice;
        BigDecimal slippage;
        int quantity;
        Integer ibkrOrderId;
        String orderType;
        Instant submittedAt;
        Instant filledAt;
        Instant closedAt;
        Long entryLatencyMs;
        BigDecimal mfeR;
        BigDecimal maeR;
        BigDecimal realizedR;
        Boolean continuationSurvival;
        Integer persistenceDurationSec;
        Boolean secondLegCaptured;
        BigDecimal postExitContinuationR;
        String exitQualityNote;
        Integer convictionScore;
        Integer dominanceScore;
        Integer executionQuality;
        String blockedReason;
        String exitSuggestion;
        Instant updatedAt;
    }

    @Value
    @Builder
    public static class MonitorSnapshotDto {
        List<PaperExecutionRecordDto> activeOrders;
        List<PaperExecutionRecordDto> activePositions;
        List<PaperExecutionRecordDto> history;
        ExecutionAnalyticsDto analytics;
    }

    @Value
    @Builder
    public static class ExecutionAnalyticsDto {
        int totalProbes;
        int openCount;
        int closedCount;
        int blockedCount;
        Map<String, RegimeStatsDto> byRegime;
        BigDecimal avgSlippage;
        BigDecimal avgRealizedR;
        BigDecimal avgMfeR;
        BigDecimal avgMaeR;
    }

    @Value
    @Builder
    public static class RegimeStatsDto {
        String regime;
        int count;
        int closed;
        BigDecimal avgRealizedR;
        BigDecimal avgMfeR;
        BigDecimal avgMaeR;
        int continuationSurvivalCount;
    }

    public static PaperExecutionRecordDto toDto(PaperExecutionRecord r) {
        return PaperExecutionRecordDto.builder()
                .id(r.getId())
                .symbol(r.getSymbol())
                .regime(r.getRegime())
                .executionMode(r.getExecutionMode())
                .status(r.getStatus())
                .planSource(r.getPlanSource())
                .entryPrice(r.getEntryPrice())
                .fillPrice(r.getFillPrice())
                .slippage(r.getSlippage())
                .quantity(r.getQuantity())
                .ibkrOrderId(r.getIbkrOrderId())
                .orderType(r.getOrderType())
                .submittedAt(r.getSubmittedAt())
                .filledAt(r.getFilledAt())
                .closedAt(r.getClosedAt())
                .entryLatencyMs(r.getEntryLatencyMs())
                .mfeR(r.getMfeR())
                .maeR(r.getMaeR())
                .realizedR(r.getRealizedR())
                .continuationSurvival(r.getContinuationSurvival())
                .persistenceDurationSec(r.getPersistenceDurationSec())
                .secondLegCaptured(r.getSecondLegCaptured())
                .postExitContinuationR(r.getPostExitContinuationR())
                .exitQualityNote(r.getExitQualityNote())
                .convictionScore(r.getConvictionScore())
                .dominanceScore(r.getDominanceScore())
                .executionQuality(r.getExecutionQuality())
                .blockedReason(r.getBlockedReason())
                .exitSuggestion(r.getExitSuggestion())
                .updatedAt(r.getUpdatedAt())
                .build();
    }
}
