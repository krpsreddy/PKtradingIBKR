package com.tradingbot.api.dto.historical;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

public final class HistoricalDtos {

    private HistoricalDtos() {}

    @Value @Builder
    public static class SetupStatisticsDto {
        String setupType;
        int lookbackDays;
        int sampleSize;
        double winRate;
        Double avgRr;
        Double avgContinuation;
        Double avgFailure;
        Double avgDurationMinutes;
        Double avgMfe;
        String bestRegime;
        String worstRegime;
        String bestTimeWindow;
        String bestSector;
        Double followThroughProbability;
        List<String> insights;
    }

    @Value @Builder
    public static class MovementIntelligenceDto {
        String setupType;
        Double expectedMovePercent;
        Double reversalMovePercent;
        Double movePersistenceProbability;
        Double extensionProbability;
        Double exhaustionProbability;
        String typicalFailureTime;
        List<String> notes;
    }

    @Value @Builder
    public static class SessionFingerprintDto {
        String sessionDate;
        String fingerprint;
        String description;
        int confidence;
        List<String> traits;
    }

    @Value @Builder
    public static class SectorMemoryDto {
        String sector;
        double winRate;
        int sampleSize;
        String bestSetup;
        String qualityLabel;
    }

    @Value @Builder
    public static class TimeOfDayIntelligenceDto {
        Map<String, Double> setupWinRatesByWindow;
        String bestOpeningSetup;
        String middayFailurePattern;
        String afternoonContinuationSetup;
        List<String> insights;
    }

    @Value @Builder
    public static class HistoricalInsightDto {
        String setupType;
        String symbol;
        int lookbackDays;
        double winRate;
        Double avgMovePercent;
        String bestRegime;
        String worstRegime;
        String bestTimeWindow;
        String typicalFailureTime;
        List<String> probabilisticNotes;
        SetupStatisticsDto statistics;
        MovementIntelligenceDto movement;
    }

    @Value @Builder
    public static class HistoricalSnapshotDto {
        int lookbackDays;
        int storedCandleDays;
        long totalOutcomes;
        List<SetupStatisticsDto> setupStatistics;
        List<SectorMemoryDto> sectorMemory;
        TimeOfDayIntelligenceDto timeOfDay;
        SessionFingerprintDto todayFingerprint;
        List<String> expandedMemoryNarratives;
        Map<String, Double> regimeSetupWinRates;
    }

    @Value @Builder
    public static class ReplayDatesDto {
        String symbol;
        List<String> availableDates;
        int lookbackDays;
    }
}
