package com.tradingbot.analytics.query.dto;

import java.util.List;
import java.util.Map;

public final class AnalyticsQueryDtos {
    private AnalyticsQueryDtos() {}

    public record AnalyticsQueryFilterDto(
            String symbol,
            String from,
            String to,
            String decision,
            String narrative,
            String quality,
            String result,
            String convictionBand
    ) {}

    public record BandMetricsDto(
            int count,
            double avgR,
            double winRate,
            double fakeoutRate,
            double continuationRate,
            double avgConviction
    ) {}

    public record ConvictionDistributionDto(
            BandMetricsDto elite,
            BandMetricsDto high,
            BandMetricsDto moderate,
            BandMetricsDto low,
            BandMetricsDto avoid,
            int totalRows,
            int histogramBuckets
    ) {}

    public record GroupStatDto(
            String group,
            int count,
            double avgR,
            double winRate,
            double fakeoutRate,
            double continuationRate,
            double avgConviction,
            double fullExecutionRate
    ) {}

    public record CrossMatrixCellDto(
            String decision,
            String narrative,
            int count,
            double avgR,
            double winRate,
            double fakeoutRate,
            double continuationRate,
            double avgConviction
    ) {}

    public record CrossMatrixDto(
            List<CrossMatrixCellDto> cells,
            int totalRows
    ) {}

    public record DiagnosticsInsightDto(
            String id,
            String question,
            String answer,
            String severity,
            Map<String, Object> metrics
    ) {}

    public record DiagnosticsSummaryDto(
            List<DiagnosticsInsightDto> insights,
            int totalSnapshots,
            int analyticsVersion,
            long generatedAt
    ) {}

    public record AnalyticsWorkbenchDto(
            ConvictionDistributionDto convictionDistribution,
            List<GroupStatDto> decisionStats,
            List<GroupStatDto> narrativeStats,
            List<GroupStatDto> qualityStats,
            List<GroupStatDto> resultStats,
            CrossMatrixDto crossMatrix,
            DiagnosticsSummaryDto diagnostics,
            int totalRows,
            long generatedAt
    ) {}
}
