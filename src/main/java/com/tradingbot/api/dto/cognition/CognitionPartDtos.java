package com.tradingbot.api.dto.cognition;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

public final class CognitionPartDtos {
    private CognitionPartDtos() {}

    @Value
    @Builder
    public static class SetupNarrativeDto {
        String symbol;
        String narrative;
        String signalType;
        List<String> highlights;
        List<String> cautions;
    }

    @Value
    @Builder
    public static class SessionPriorityDto {
        String insight;
        String category;
        String severity;
        String detail;
    }

    @Value
    @Builder
    public static class SessionTemperatureDto {
        String label;
        String description;
        int intensity;
    }

    @Value
    @Builder
    public static class CoachingFeedItemDto {
        String type;
        String message;
        String severity;
        long timestamp;
    }

    @Value
    @Builder
    public static class MarketPersonalityDto {
        String personality;
        String description;
        List<String> traits;
    }

    @Value
    @Builder
    public static class PremarketBriefDto {
        boolean active;
        String likelyRegime;
        List<String> overnightMovers;
        List<String> highGapNames;
        List<String> strongestSectors;
        List<String> likelyMomentumSymbols;
        List<String> notes;
    }

    @Value
    @Builder
    public static class PersonalizedCoachingDto {
        List<String> insights;
        String strongestEdge;
        String weakestPattern;
    }

    @Value
    @Builder
    public static class TraderDisciplineDto {
        int score;
        String label;
        List<String> factors;
    }

    @Value
    @Builder
    public static class IntelligenceEventDto {
        String id;
        String type;
        String message;
        String severity;
        String symbol;
        long timestamp;
    }

    @Value
    @Builder
    public static class MarketMemoryNarrativeDto {
        List<String> narratives;
    }

    @Value
    @Builder
    public static class ProbabilisticGuidanceDto {
        Double continuationProbability;
        Double openingMomentumProbability;
        String bestRegime;
        String weakRegime;
        String bestEntryQuality;
        Double historicalRrAverage;
        String signalType;
    }

    @Value
    @Builder
    public static class IntelligenceSummaryDto {
        String whatMattersMost;
        String whatToAvoid;
        String strongestSetupsToday;
        String behaviorHurtingPerformance;
        String activeRegime;
        String bestPlaybookToday;
    }

    @Value
    @Builder
    public static class AiSessionReviewDto {
        String narrative;
        List<String> bestOpportunities;
        List<String> strongestSectors;
        List<String> failedPatterns;
        List<String> traderStrengths;
        List<String> traderMistakes;
        List<String> regimeTransitions;
        List<String> behaviorCoaching;
        String bestPlaybook;
    }

    @Value
    @Builder
    public static class PerformanceHeatmapDto {
        Map<String, Double> setupWinRates;
        Map<String, Double> timeWindowWinRates;
        Map<String, Double> regimeWinRates;
        List<String> worstBehaviors;
        Map<String, Integer> executionQualityDistribution;
        Map<String, Integer> rrDistribution;
    }

    @Value
    @Builder
    public static class VisualEmphasisDto {
        String highPriorityTarget;
        String highPriorityClass;
        List<String> mutedTargets;
    }

    @Value
    @Builder
    public static class ReplayNarrativeDto {
        String symbol;
        String narrative;
        List<String> improvements;
        List<String> deteriorations;
        List<String> idealEntries;
    }
}
