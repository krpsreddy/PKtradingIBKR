package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.BehaviorInsightDto;
import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.BiasAlertDto;
import com.tradingbot.intelligence.BehaviorAnalyticsService;
import com.tradingbot.models.SignalOutcome;
import com.tradingbot.repository.SignalOutcomeRepository;
import com.tradingbot.services.MarketTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BiasDetectionService {

    private final BehaviorAnalyticsService behaviorAnalyticsService;
    private final SignalOutcomeRepository outcomeRepository;

    public List<BiasAlertDto> detect(String entryQuality, boolean regimeBullish, String setupType) {
        List<BiasAlertDto> alerts = new ArrayList<>();
        List<BehaviorInsightDto> insights = behaviorAnalyticsService.todayInsights();

        for (BehaviorInsightDto i : insights) {
            if ("CHASING".equals(i.getType())) {
                alerts.add(alert("FORCING", "Forcing Momentum Entries", "HIGH"));
            }
            if ("LATE_ENTRIES".equals(i.getType())) {
                alerts.add(alert("CHASING", "Chasing Continuation", "MEDIUM"));
            }
            if ("OVERTRADING".equals(i.getType())) {
                alerts.add(alert("REVENGE", "Possible Revenge Trading", "HIGH"));
            }
        }

        LocalDate today = MarketTime.nowLocal().toLocalDate();
        List<SignalOutcome> todayOutcomes = outcomeRepository.findBySessionDateOrderByRecordedAtDesc(today);
        long bullishSetups = todayOutcomes.stream()
                .filter(o -> o.getSetupType() != null && !o.getSetupType().contains("FAIL"))
                .count();
        long bearishSetups = todayOutcomes.stream()
                .filter(o -> o.getSetupType() != null && o.getSetupType().contains("FAIL"))
                .count();
        if (bullishSetups >= 4 && bearishSetups == 0 && !regimeBullish) {
            alerts.add(alert("BULLISH_BIAS", "Bullish Bias Detected", "MEDIUM"));
        }

        if ("CHASING".equals(entryQuality)) {
            alerts.add(alert("CHASING", "Chasing Extended Setup", "HIGH"));
        }
        if ("LATE".equals(entryQuality) && setupType != null && setupType.contains("OPEN")) {
            alerts.add(alert("LOW_CONVICTION", "Low Conviction Late Entry", "MEDIUM"));
        }

        long recentLosses = todayOutcomes.stream().filter(o -> "LOSS".equals(o.getOutcome())).count();
        if (recentLosses >= 2 && todayOutcomes.size() >= 3) {
            alerts.add(alert("FEAR", "Fear Exit Risk After Losses", "LOW"));
        }

        return alerts.stream().distinct().limit(4).toList();
    }

    private BiasAlertDto alert(String type, String message, String severity) {
        return BiasAlertDto.builder().type(type).message(message).severity(severity).build();
    }
}
