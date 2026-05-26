package com.tradingbot.intelligence.options;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.*;
import com.tradingbot.intelligence.dto.SymbolIntelligenceDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.time.ZonedDateTime;

@Service
@RequiredArgsConstructor
public class OptionsExecutionOrchestrator {

    private static final ZoneId ET = ZoneId.of("America/New_York");

    private final OptionsExecutionService optionsExecutionService;
    private final CapitalPreservationService capitalPreservationService;
    private final MarketEmotionService marketEmotionService;

    public OptionsExecutionSnapshotDto snapshot(
            String signalType,
            String regime,
            String entryQuality,
            int setupAgeMinutes,
            double rvol,
            boolean extended,
            boolean regimeAligned,
            boolean deteriorating,
            ExpectedMoveDto expectedMove,
            SetupHalfLifeDto halfLife,
            ProbabilityDecayDto decay,
            FailureSignatureDto failure,
            AdaptiveExitDto exit,
            MarketTrendDto trend,
            MarketMemoryDto memory,
            SymbolIntelligenceDto intel) {

        if (signalType == null || signalType.isBlank() || "WATCH".equals(signalType)) {
            return null;
        }

        ZonedDateTime now = ZonedDateTime.now(ET);
        boolean choppy = trend != null && trend.isChoppy();

        OptionsIntelContext ctx = OptionsIntelContext.builder()
                .signalType(signalType)
                .regime(regime != null ? regime : "TRENDING_BULL")
                .entryQuality(entryQuality != null ? entryQuality : "GOOD")
                .setupAgeMinutes(setupAgeMinutes)
                .rvol(rvol)
                .extended(extended)
                .choppy(choppy)
                .regimeAligned(regimeAligned)
                .deteriorating(deteriorating)
                .expectedMove(expectedMove)
                .halfLife(halfLife)
                .decay(decay)
                .failure(failure)
                .exit(exit)
                .etHour(now.getHour())
                .etMinute(now.getMinute())
                .trend(trend)
                .build();

        OptionsExecutionSnapshotDto core = optionsExecutionService.analyze(ctx);
        var preservation = capitalPreservationService.assess(ctx, trend, memory, core.getOptionConfidence());
        var emotion = marketEmotionService.assess(trend, memory, ctx);

        return OptionsExecutionSnapshotDto.builder()
                .idealDirection(core.getIdealDirection())
                .recommendedStrikeType(core.getRecommendedStrikeType())
                .recommendedExpiry(core.getRecommendedExpiry())
                .strikeGuidance(core.getStrikeGuidance())
                .expectedPremiumExpansion(core.getExpectedPremiumExpansion())
                .expectedPremiumDeterioration(core.getExpectedPremiumDeterioration())
                .thetaRisk(core.getThetaRisk())
                .thetaWarnings(core.getThetaWarnings())
                .ivRisk(core.getIvRisk())
                .ivLabel(core.getIvLabel())
                .holdWindow(core.getHoldWindow())
                .expectedMoveVelocity(core.getExpectedMoveVelocity())
                .optionExecutionQuality(core.getOptionExecutionQuality())
                .optionConfidence(core.getOptionConfidence())
                .avoidReason(core.getAvoidReason())
                .capitalPreservation(CapitalPreservationDto.builder()
                        .mode(preservation.mode())
                        .message(preservation.message())
                        .reasons(preservation.reasons())
                        .build())
                .marketEmotion(MarketEmotionDto.builder()
                        .label(emotion.label())
                        .description(emotion.description())
                        .build())
                .build();
    }
}
