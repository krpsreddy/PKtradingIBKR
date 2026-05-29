package com.tradingbot.discovery.historical;

import java.util.List;

/** Phase 204 — structured historical bulk discovery (research only). */
public final class HistoricalBulkDiscoveryDtos {

    private HistoricalBulkDiscoveryDtos() {}

    public record HistoricalMetaDto(
            int lookbackDays,
            int sampleCount,
            long generatedAtMs,
            String disclaimer,
            String direction,
            String focusLabel
    ) {}

    public record PutEntryQualityRowDto(
            String grade,
            int sampleCount,
            double followThroughPct,
            double breakdownSurvivalPct,
            int discoveryConfidenceScore
    ) {}

    public record SqueezeRiskRowDto(
            String context,
            int sampleCount,
            int squeezeRiskScore,
            String note
    ) {}

    public record BreakdownProfileRowDto(
            String profile,
            int sampleCount,
            double breakdownSurvivalPct,
            double failedBouncePct,
            double accelerationPct,
            double squeezeRiskAvg
    ) {}

    public record HistoricalRegimeRowDto(
            String regime,
            int frequency,
            double winRate,
            double avgMfeR,
            double continuationProbability,
            double secondLegSurvivalPct,
            double failureProbability,
            int discoveryConfidenceScore,
            String expectancyLabel
    ) {}

    public record RegimeFamilyClusterDto(
            String family,
            int sampleCount,
            double winRate,
            double avgMfeR,
            double continuationPct,
            List<String> memberRegimes,
            int discoveryConfidenceScore
    ) {}

    public record MarketStructureRowDto(
            String structure,
            int sampleCount,
            double winRate,
            double continuationPct,
            String note
    ) {}

    public record ContinuationProfileRowDto(
            String profile,
            int sampleCount,
            double persistenceSurvivalPct,
            double secondLegProbability,
            double exhaustionTimingScore,
            double trendDecayPct
    ) {}

    public record HistoricalFailureClusterDto(
            String clusterKey,
            int failureCount,
            double sharePct,
            List<String> conditions
    ) {}

    public record SectorDnaRowDto(
            String sector,
            int sampleCount,
            double continuationPct,
            double failurePct,
            String strengthNote
    ) {}

    public record SessionBehaviorRowDto(
            String session,
            int sampleCount,
            double winRate,
            double continuationPct,
            String topRegime
    ) {}

    public record TrendMaturityRowDto(
            String maturity,
            int sampleCount,
            double continuationPct,
            double failurePct
    ) {}

    public record RegimeEvolutionPathDto(
            String path,
            int occurrences,
            double successPct
    ) {}

    public record HistoricalVsLiveRowDto(
            String regime,
            double historicalWinPct,
            double paperWinPct,
            double historicalCapturePct,
            double paperCapturePct,
            double gapPct,
            String verdict
    ) {}

    public record HistoricalBulkDiscoveryReportDto(
            HistoricalMetaDto meta,
            List<String> insights,
            List<HistoricalRegimeRowDto> regimeDiscovery,
            List<RegimeFamilyClusterDto> regimeFamilies,
            List<MarketStructureRowDto> marketStructure,
            List<ContinuationProfileRowDto> continuationProfiles,
            List<HistoricalFailureClusterDto> failureClusters,
            List<SectorDnaRowDto> sectorDna,
            List<SessionBehaviorRowDto> sessionBehavior,
            List<TrendMaturityRowDto> trendMaturity,
            List<RegimeEvolutionPathDto> regimeEvolution,
            List<HistoricalVsLiveRowDto> historicalVsLive,
            List<HistoricalRegimeRowDto> topDiscoveries,
            List<PutEntryQualityRowDto> putEntryQuality,
            List<SqueezeRiskRowDto> squeezeRisk,
            List<BreakdownProfileRowDto> breakdownProfiles
    ) {}
}
