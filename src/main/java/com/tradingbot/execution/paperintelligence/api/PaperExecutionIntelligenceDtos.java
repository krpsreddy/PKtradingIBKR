package com.tradingbot.execution.paperintelligence.api;

import java.math.BigDecimal;
import java.util.List;

public final class PaperExecutionIntelligenceDtos {

    private PaperExecutionIntelligenceDtos() {}

    public record ExecutionReviewSummaryDto(
            int closedTrades,
            double avgCapturePct,
            double avgSlippagePct,
            double prematureExitPct,
            double avgExecutionScore,
            List<String> insights
    ) {}

    public record TrailingAnalysisDto(
            String symbol,
            String trailingState,
            BigDecimal trailingStop,
            String deterioration,
            int stopTightness
    ) {}

    public record FillQualityRowDto(
            String symbol,
            String fillQuality,
            Long fillLatencyMs,
            BigDecimal slippagePct,
            Integer fillProbability
    ) {}

    public record SlippageAnalysisDto(
            double avgSlippagePct,
            int poorFillCount,
            List<FillQualityRowDto> worstFills
    ) {}

    public record ContinuationCaptureDto(
            double avgCapturePct,
            int prematureCount,
            int overstayedCount,
            List<String> lifecycleInsights
    ) {}

    public record PrematureExitRowDto(
            String symbol,
            String regime,
            BigDecimal mfeR,
            BigDecimal realizedR,
            BigDecimal capturePct,
            String exitReason
    ) {}
}
