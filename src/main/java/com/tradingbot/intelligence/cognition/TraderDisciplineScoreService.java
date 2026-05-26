package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.BehaviorInsightDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.TraderDisciplineDto;
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
public class TraderDisciplineScoreService {

    private final SignalOutcomeRepository outcomeRepository;

    public TraderDisciplineDto score(List<BehaviorInsightDto> behavior) {
        LocalDate today = MarketTime.nowLocal().toLocalDate();
        List<SignalOutcome> outcomes = outcomeRepository.findBySessionDateOrderByRecordedAtDesc(today);

        int score = 85;
        List<String> factors = new ArrayList<>();

        long late = outcomes.stream()
                .filter(o -> "LATE".equals(o.getEntryQuality()) || "CHASING".equals(o.getEntryQuality()))
                .count();
        if (late >= 2) {
            score -= 15;
            factors.add("Late entries detected");
        } else if (late == 1) {
            score -= 8;
            factors.add("One late entry");
        }

        long chasing = outcomes.stream().filter(o -> "CHASING".equals(o.getEntryQuality())).count();
        if (chasing >= 1) {
            score -= 10;
            factors.add("Chasing extended setups");
        }

        long losses = outcomes.stream().filter(o -> "LOSS".equals(o.getOutcome())).count();
        long wins = outcomes.stream().filter(o -> "WIN".equals(o.getOutcome())).count();
        if (losses >= 3 && wins == 0) {
            score -= 20;
            factors.add("Revenge/overtrading risk");
        }

        if (outcomes.size() > 8) {
            score -= 10;
            factors.add("High trade count today");
        }

        for (BehaviorInsightDto b : behavior) {
            if ("POSITIVE".equals(b.getType())) {
                score += 5;
                factors.add("Good process: " + b.getTitle());
            }
        }

        if (outcomes.isEmpty()) {
            factors.add("No trades logged — patience maintained");
        }

        score = Math.max(0, Math.min(100, score));
        String label = score >= 80 ? "Disciplined" : score >= 60 ? "Moderate" : score >= 40 ? "At Risk" : "Undisciplined";

        return TraderDisciplineDto.builder()
                .score(score)
                .label(label)
                .factors(factors.stream().limit(5).toList())
                .build();
    }
}
