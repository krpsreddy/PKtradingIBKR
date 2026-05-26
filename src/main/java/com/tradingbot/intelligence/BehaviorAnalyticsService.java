package com.tradingbot.intelligence;

import com.tradingbot.api.dto.BehaviorInsightDto;
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
public class BehaviorAnalyticsService {

    private final SignalOutcomeRepository outcomeRepository;

    public List<BehaviorInsightDto> todayInsights() {
        LocalDate sessionDate = MarketTime.nowLocal().toLocalDate();
        List<SignalOutcome> outcomes = outcomeRepository.findBySessionDateOrderByRecordedAtDesc(sessionDate);
        List<BehaviorInsightDto> insights = new ArrayList<>();

        if (outcomes.isEmpty()) return insights;

        long late = outcomes.stream().filter(o -> "LATE".equals(o.getEntryQuality()) || "CHASING".equals(o.getEntryQuality())).count();
        if (late >= 2) {
            insights.add(warn("LATE_ENTRIES", "⚠ Your late entries are underperforming today",
                    "Consider waiting for FRESH/GOOD entry quality."));
        }

        long chasing = outcomes.stream().filter(o -> "CHASING".equals(o.getEntryQuality())).count();
        if (chasing >= 1) {
            insights.add(warn("CHASING", "⚠ You are chasing extended setups today",
                    "Extended + late entries historically underperform."));
        }

        long lossCount = outcomes.stream().filter(o -> "LOSS".equals(o.getOutcome())).count();
        long winCount = outcomes.stream().filter(o -> "WIN".equals(o.getOutcome())).count();
        if (lossCount >= 3 && winCount == 0) {
            insights.add(warn("OVERTRADING", "⚠ Possible overtrading detected",
                    "Step back — market may lack edge right now."));
        }

        var bestSetup = outcomes.stream()
                .filter(o -> "WIN".equals(o.getOutcome()) && o.getSetupType() != null)
                .map(SignalOutcome::getSetupType)
                .findFirst();
        bestSetup.ifPresent(s -> insights.add(BehaviorInsightDto.builder()
                .type("POSITIVE")
                .title("Best performance today: " + s)
                .detail("Lean into what's working.")
                .build()));

        return insights;
    }

    private BehaviorInsightDto warn(String type, String title, String detail) {
        return BehaviorInsightDto.builder().type(type).title(title).detail(detail).build();
    }
}
