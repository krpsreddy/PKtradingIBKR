package com.tradingbot.discovery;

import java.math.BigDecimal;
import java.util.List;

/** Phase 203 — empirical regime intelligence API contracts. */
public final class DiscoveryDtos {

    private DiscoveryDtos() {}

    public record LookbackMetaDto(int days, String fromDate, String toDate, int closedTrades, int decisionTraces) {}

    public record RegimePerformanceRowDto(
            String regime,
            int tradeCount,
            double winRate,
            BigDecimal avgR,
            double continuationCapturePct,
            BigDecimal avgHoldSec,
            BigDecimal avgMfeR,
            BigDecimal avgMaeR,
            double secondLegSurvivalPct,
            String bestEnvironment,
            double failureRate
    ) {}

    public record StructureFitCellDto(
            String regime,
            String marketStructure,
            int tradeCount,
            double winRate,
            BigDecimal avgR,
            double continuationCapturePct,
            String verdict
    ) {}

    public record EntryQualityRowDto(
            String entryQuality,
            int tradeCount,
            double winRate,
            BigDecimal avgR,
            double continuationCapturePct,
            double continuationSurvivalPct,
            double failureProbability
    ) {}

    public record ExitQualityRowDto(
            String exitType,
            int tradeCount,
            double continuationCapturePct,
            BigDecimal avgR,
            double prematureExitRate,
            double holdEfficiency
    ) {}

    public record ContinuationCaptureRowDto(
            String dimension,
            String bucket,
            int tradeCount,
            double continuationCapturePct,
            BigDecimal avgR
    ) {}

    public record SessionRowDto(
            String sessionPeriod,
            int tradeCount,
            double winRate,
            BigDecimal avgR,
            double continuationCapturePct,
            String strongestRegime
    ) {}

    public record SectorRowDto(
            String sector,
            int tradeCount,
            double winRate,
            BigDecimal avgR,
            double continuationCapturePct,
            String topRegime
    ) {}

    public record BearishAssistRowDto(
            String bearishState,
            int triggerCount,
            double avgBias,
            double followThroughPct,
            double bounceFailurePct,
            String note
    ) {}

    public record FailureClusterDto(
            String clusterKey,
            int lossCount,
            double avgLossR,
            double shareOfLossesPct,
            List<String> conditions
    ) {}

    public record DecisionTraceInsightDto(
            String category,
            int count,
            double avgOutcomeR,
            String summary
    ) {}

    public record RegimeClusterArchitectureDto(
            String status,
            String description,
            List<String> plannedDimensions
    ) {}

    public record DiscoveryInsightsDto(List<String> insights, int sampleSize, String disclaimer) {}

    public record RegimeIntelligenceReportDto(
            LookbackMetaDto meta,
            List<RegimePerformanceRowDto> topRegimes,
            List<StructureFitCellDto> marketStructureFit,
            List<EntryQualityRowDto> entryQuality,
            List<ExitQualityRowDto> exitQuality,
            List<ContinuationCaptureRowDto> continuationCapture,
            List<SessionRowDto> sessionAnalysis,
            List<SectorRowDto> sectorAnalysis,
            List<BearishAssistRowDto> bearishAnalysis,
            List<FailureClusterDto> failureClusters,
            List<DecisionTraceInsightDto> decisionTraceAnalysis,
            RegimeClusterArchitectureDto clusterArchitecture,
            DiscoveryInsightsDto insights
    ) {}
}
