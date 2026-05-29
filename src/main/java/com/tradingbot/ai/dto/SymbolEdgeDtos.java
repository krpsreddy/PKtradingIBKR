package com.tradingbot.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/** Phase 132 — compressed symbol edge intelligence (analytics only, no auto-trade). */
public final class SymbolEdgeDtos {
    private SymbolEdgeDtos() {}

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OverallStatsDto {
        int trades;
        double winRate;
        double expectancy;
        double avgMfe;
        double avgMae;
        double hit1RRate;
        double hit2RRate;
        String confidence;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SetupStatsDto {
        String type;
        int sample;
        double winRate;
        double expectancy;
        Double avgMfe;
        Double avgMae;
        String confidence;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RegimeStatsDto {
        String name;
        int sample;
        double winRate;
        double expectancy;
        Double continuationQuality;
        String confidence;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BucketStatsDto {
        String bucket;
        int sample;
        double winRate;
        double expectancy;
        Double avgMfe;
        Double avgMae;
        Double failureRate;
        Double continuationRate;
        String confidence;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LateEntryPenaltyDto {
        double idealExpectancy;
        double lateExpectancy;
        double expectancyDropPct;
    }

    @Data
    @Builder(toBuilder = true)
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SymbolEdgeCompressedDto {
        String symbol;
        int lookbackDays;
        int evaluatedTrades;
        OverallStatsDto overall;
        SetupStatsDto bestSetup;
        SetupStatsDto worstSetup;
        RegimeStatsDto bestRegime;
        RegimeStatsDto worstRegime;
        String bestTimeWindow;
        LateEntryPenaltyDto lateEntryPenalty;
        Map<String, BucketStatsDto> premarketExtension;
        List<SetupStatsDto> bySetup;
        List<RegimeStatsDto> byRegime;
        List<BucketStatsDto> byEntryQuality;
        List<BucketStatsDto> byRvol;
        List<BucketStatsDto> byTimeOfDay;
    }

    @Data
    @Builder(toBuilder = true)
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SymbolEdgeAiAnalysisDto {
        List<String> strengths;
        List<String> weaknesses;
        List<String> bestConditions;
        List<String> avoidConditions;
        List<String> optimizationSuggestions;
        List<String> executionNotes;
        String confidence;
        Double confidenceScore;
        String summary;
    }

    @Data
    @Builder(toBuilder = true)
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SymbolEdgeAnalysisResponseDto {
        String symbol;
        int lookbackDays;
        String dataSource;
        String aggregateConfidence;
        int evaluatedTrades;
        SymbolEdgeCompressedDto deterministic;
        SymbolEdgeAiAnalysisDto ai;
        String provider;
        long latencyMs;
        boolean fallbackUsed;
        List<String> warnings;
    }
}
