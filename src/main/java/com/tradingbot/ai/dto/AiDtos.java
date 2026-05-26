package com.tradingbot.ai.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

public final class AiDtos {
    private AiDtos() {}

    /** Compressed intelligence snapshot — never raw candles or ticks. */
    @Value
    @Builder
    public static class AiExecutionRequestDto {
        String symbol;
        String signalType;
        String marketRegime;
        double rvol;
        double trendAlignment;
        double convictionScore;
        double premarketExtension;
        double entryDistanceFromVWAP;
        double historicalWinRate;
        double expectancyR;
        Double fakeoutRisk;
        String currentState;
        String marketBreadth;
        String openType;
    }

    @Value
    @Builder(toBuilder = true)
    public static class AiExecutionResponseDto {
        String provider;
        long latencyMs;
        boolean available;
        boolean fallbackUsed;
        Double continuationProbability;
        Double fakeoutProbability;
        String entryQuality;
        String recommendedAction;
        String suggestedEntry;
        List<String> reasoning;
        Double confidence;
        String summary;
        String compactLine;
        List<String> warnings;
    }

    @Value
    @Builder
    public static class OpenStructureRequestDto {
        String symbol;
        String marketRegime;
        String marketBreadth;
        int openCandidateCount;
        String topOpenType;
        double avgGapPercent;
        double avgRvol;
    }

    @Value
    @Builder(toBuilder = true)
    public static class OpenStructureResponseDto {
        String provider;
        long latencyMs;
        boolean available;
        boolean fallbackUsed;
        String classification;
        String structureAssessment;
        String entryTimingGuidance;
        String compactLine;
        List<String> warnings;
        Double confidence;
    }

    @Value
    @Builder
    public static class CoachingRequestDto {
        String symbol;
        String marketRegime;
        String marketBreadth;
        List<String> behaviorHighlights;
        String edgeSummary;
        String sessionSummary;
    }

    @Value
    @Builder(toBuilder = true)
    public static class CoachingResponseDto {
        String provider;
        long latencyMs;
        boolean available;
        boolean fallbackUsed;
        String headline;
        List<String> suggestions;
        List<String> psychologyNotes;
        Double confidence;
    }

    @Value
    @Builder
    public static class AiProviderStatusDto {
        boolean enabled;
        String configuredProvider;
        String activeProvider;
        boolean providerAvailable;
        String model;
        String message;
    }
}
