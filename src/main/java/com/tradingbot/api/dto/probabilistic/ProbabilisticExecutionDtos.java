package com.tradingbot.api.dto.probabilistic;

import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.Map;

public final class ProbabilisticExecutionDtos {

    private ProbabilisticExecutionDtos() {}

    @Value @Builder
    public static class ProbabilisticExecutionSnapshotDto {
        ExpectedMoveDto expectedMove;
        SetupHalfLifeDto halfLife;
        ProbabilityDecayDto probabilityDecay;
        FailureSignatureDto failureSignature;
        SetupDnaDto setupDna;
        TradeExpectancyDto expectancy;
        AdaptiveExitDto adaptiveExit;
        DecisionQualityDto decisionQuality;
        MarketTrustDto marketTrust;
        OptionsExpectancyDto optionsExpectancy;
        List<BiasAlertDto> biasAlerts;
        List<String> coachingEvolution;
        List<String> topPriorities;
        RegimeAdaptationDto regimeAdaptation;
        WhyNowDto whyNow;
        SetupMaturityDto setupMaturity;
        OptionsExecutionSnapshotDto optionsExecution;
        long timestamp;
    }

    @Value @Builder
    public static class ExpectedMoveDto {
        String setupType;
        String symbol;
        Double typicalMoveLowPercent;
        Double typicalMoveHighPercent;
        Double averageContinuationPercent;
        Double typicalRetracementPercent;
        String summary;
    }

    @Value @Builder
    public static class SetupHalfLifeDto {
        String setupType;
        int peakEdgeMinutes;
        int halfLifeMinutes;
        String summary;
        String timingGuidance;
    }

    @Value @Builder
    public static class ProbabilityDecayDto {
        double continuationProbability;
        double exhaustionProbability;
        double reversalProbability;
        double failureProbability;
        double continuationStart;
        double continuationCurrent;
        List<ProbabilityPointDto> trend;
        String exhaustionRisk; // LOW, MEDIUM, HIGH
    }

    @Value @Builder
    public static class ProbabilityPointDto {
        int minuteOffset;
        double continuation;
        double failure;
    }

    @Value @Builder
    public static class FailureSignatureDto {
        int failureProbability;
        String severity;
        List<String> patterns;
        String message;
    }

    @Value @Builder
    public static class SetupDnaDto {
        String personality;
        String description;
        List<String> traits;
    }

    @Value @Builder
    public static class TradeExpectancyDto {
        Double expectedRr;
        Double historicalExpectancyR;
        Double winRate;
        String qualityLabel;
        List<String> notes;
    }

    @Value @Builder
    public static class AdaptiveExitDto {
        String state; // HOLD, SCALE_PARTIAL, TAKE_PROFIT, EXIT_SOON, EXIT_NOW
        String guidance;
        List<String> triggers;
        boolean optionsEdgeDeteriorating;
    }

    @Value @Builder
    public static class DecisionQualityDto {
        String label; // GOOD_DECISION, LOW_QUALITY, LUCKY_WIN, DISCIPLINED_LOSS
        String detail;
        int score;
    }

    @Value @Builder
    public static class MarketTrustDto {
        int score;
        String label;
        List<String> factors;
    }

    @Value @Builder
    public static class OptionsExpectancyDto {
        Double idealHoldMinutes;
        String moveSpeed; // FAST, MODERATE, SLOW
        Double lateEntryDecayRisk;
        Double extensionRisk;
        String warning;
    }

    @Value @Builder
    public static class BiasAlertDto {
        String type;
        String message;
        String severity;
    }

    @Value @Builder
    public static class RegimeAdaptationDto {
        String regime;
        String setupType;
        int confidenceAdjustment;
        String message;
    }

    @Value @Builder
    public static class RegimePerformanceDto {
        String regime;
        double winRate;
        String label; // EXCELLENT, GOOD, POOR, TERRIBLE
    }

    @Value @Builder
    public static class ReplayProbabilisticDto {
        String symbol;
        int barIndex;
        ProbabilityDecayDto probabilities;
        ExpectedMoveDto expectedMove;
        AdaptiveExitDto exitGuidance;
        FailureSignatureDto failure;
    }

    @Value @Builder
    public static class WhyNowDto {
        String headline;
        List<String> reasons;
        int convictionScore;
    }

    @Value @Builder
    public static class ContextualPlaybookHintDto {
        String playbookId;
        String status; // FAVORING, WEAK, NEUTRAL, ACTIVE, AVOID
        String reason;
    }

    @Value @Builder
    public static class SetupMaturityDto {
        String stage;
        String label;
        int score;
    }

    @Value @Builder
    public static class MarketHeartbeatDto {
        List<String> pulses;
        MarketEmotionDto marketEmotion;
        long timestamp;
    }

    @Value @Builder
    public static class OptionsExecutionSnapshotDto {
        String idealDirection;
        String recommendedStrikeType;
        String recommendedExpiry;
        String strikeGuidance;
        String expectedPremiumExpansion;
        String expectedPremiumDeterioration;
        String thetaRisk;
        List<String> thetaWarnings;
        String ivRisk;
        String ivLabel;
        String holdWindow;
        String expectedMoveVelocity;
        int optionExecutionQuality;
        int optionConfidence;
        String avoidReason;
        CapitalPreservationDto capitalPreservation;
        MarketEmotionDto marketEmotion;
    }

    @Value @Builder
    public static class CapitalPreservationDto {
        String mode; // CLEAR, DO_NOTHING, WAIT, NO_EDGE, PRESERVE_CAPITAL
        String message;
        List<String> reasons;
    }

    @Value @Builder
    public static class MarketEmotionDto {
        String label;
        String description;
    }
}
