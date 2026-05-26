package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.ProbabilityDecayDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.ProbabilityPointDto;
import com.tradingbot.intelligence.AdaptiveRankingService;
import com.tradingbot.intelligence.historical.SetupStatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProbabilityDecayService {

    private final AdaptiveRankingService adaptiveRankingService;
    private final SetupStatisticsService setupStatisticsService;

    public ProbabilityDecayDto decay(String setupType, String regime, int setupAgeMinutes,
                                     double rvol, boolean vwapHold, boolean deteriorating) {
        String setup = SetupStatisticsService.normalize(setupType);
        double baseCont = adaptiveRankingService.winRate(setup, regime != null ? regime : "TRENDING_BULL");
        if (baseCont < 0) baseCont = setupStatisticsService.statistics(setup).getWinRate() * 100;
        if (baseCont < 0) baseCont = 55;

        double ageDecay = Math.min(0.35, setupAgeMinutes * 0.012);
        double rvolDecay = rvol < 1.2 ? 0.12 : rvol < 1.5 ? 0.05 : 0;
        double vwapDecay = vwapHold ? 0 : 0.15;
        double detDecay = deteriorating ? 0.18 : 0;

        double cont = Math.max(5, baseCont * (1 - ageDecay - rvolDecay - vwapDecay - detDecay));
        double fail = Math.min(85, 100 - cont - 10 + detDecay * 50);
        double exhaust = Math.min(70, ageDecay * 100 + (rvol < 1.3 ? 15 : 0));
        double reversal = Math.min(40, fail * 0.4);

        List<ProbabilityPointDto> trend = buildTrend(baseCont, cont, setupAgeMinutes);

        String exhaustRisk = exhaust >= 50 ? "HIGH" : exhaust >= 25 ? "MEDIUM" : "LOW";

        return ProbabilityDecayDto.builder()
                .continuationProbability(Math.round(cont * 10) / 10.0)
                .exhaustionProbability(Math.round(exhaust * 10) / 10.0)
                .reversalProbability(Math.round(reversal * 10) / 10.0)
                .failureProbability(Math.round(fail * 10) / 10.0)
                .continuationStart(Math.round(baseCont * 10) / 10.0)
                .continuationCurrent(Math.round(cont * 10) / 10.0)
                .trend(trend)
                .exhaustionRisk(exhaustRisk)
                .build();
    }

    private List<ProbabilityPointDto> buildTrend(double start, double current, int ageMin) {
        List<ProbabilityPointDto> points = new ArrayList<>();
        points.add(ProbabilityPointDto.builder().minuteOffset(0).continuation(start).failure(100 - start).build());
        points.add(ProbabilityPointDto.builder().minuteOffset(Math.max(1, ageMin / 2))
                .continuation((start + current) / 2).failure(100 - (start + current) / 2).build());
        points.add(ProbabilityPointDto.builder().minuteOffset(ageMin).continuation(current).failure(100 - current).build());
        return points;
    }
}
