package com.tradingbot.bearish;

import com.tradingbot.livetrader.LiveTraderDtos;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

/** Phase 210 — top bearish opportunities for mobile PUT assist (from existing tier1 rankings). */
@Component
public class TopBearishOpportunitySelector {

    private static final int DEFAULT_LIMIT = 5;
    private static final int MAX_SQUEEZE = 74;

    private final BearishOperationalService bearishOperationalService;

    public TopBearishOpportunitySelector(BearishOperationalService bearishOperationalService) {
        this.bearishOperationalService = bearishOperationalService;
    }

    public List<LiveTraderDtos.BearishOpportunityMobileDto> selectTop(
            List<LiveTraderDtos.RankedOpportunityDto> ranked,
            int limit
    ) {
        if (ranked == null || ranked.isEmpty()) {
            return List.of();
        }
        int cap = limit > 0 ? limit : DEFAULT_LIMIT;
        return ranked.stream()
                .map(bearishOperationalService::assess)
                .filter(a -> eligible(a.ranked(), a.putGrade().grade()))
                .sorted(Comparator
                        .comparingInt((BearishOperationalService.OperationalAssessment a) ->
                                gradeRank(a.putGrade().grade()))
                        .reversed()
                        .thenComparingInt(a -> a.ranked().bearishBias())
                        .reversed())
                .limit(cap)
                .map(a -> toMobile(a, ranked))
                .toList();
    }

    private static boolean eligible(BearishOpportunityDto dto, PutAssistGrade grade) {
        if (grade != PutAssistGrade.A_PLUS && grade != PutAssistGrade.A) {
            return false;
        }
        if (dto.squeezeRisk() > MAX_SQUEEZE) {
            return false;
        }
        if ("LOW".equalsIgnoreCase(dto.breakdownQuality())) {
            return false;
        }
        if (grade == PutAssistGrade.A && !"HIGH".equalsIgnoreCase(dto.breakdownQuality())) {
            return false;
        }
        return true;
    }

    private static String formatPutGrade(PutAssistGrade g) {
        return switch (g) {
            case A_PLUS -> "A+";
            case A -> "A";
            case B -> "B";
            default -> "AVOID";
        };
    }

    private static int gradeRank(PutAssistGrade g) {
        return switch (g) {
            case A_PLUS -> 4;
            case A -> 3;
            case B -> 2;
            default -> 0;
        };
    }

    private static LiveTraderDtos.BearishOpportunityMobileDto toMobile(
            BearishOperationalService.OperationalAssessment a,
            List<LiveTraderDtos.RankedOpportunityDto> ranked
    ) {
        BearishOpportunityDto dto = a.ranked();
        int persistence = ranked.stream()
                .filter(o -> o.symbol().equalsIgnoreCase(dto.symbol()))
                .mapToInt(LiveTraderDtos.RankedOpportunityDto::persistenceSeconds)
                .findFirst()
                .orElse(0);
        String narrative = dto.narrative();
        if (narrative != null && narrative.length() > 160) {
            narrative = narrative.substring(0, 160) + "…";
        }
        return new LiveTraderDtos.BearishOpportunityMobileDto(
                dto.symbol(),
                dto.bearishRegime(),
                dto.breakdownQuality(),
                dto.bearishBias(),
                persistence,
                dto.continuationProbability(),
                dto.squeezeRisk(),
                formatPutGrade(dto.putGrade()),
                narrative != null ? narrative : ""
        );
    }
}
