package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.FailureSignatureDto;
import com.tradingbot.intelligence.dto.SetupDeteriorationDto;
import com.tradingbot.intelligence.historical.SetupStatisticsService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class FailureSignatureService {

    public FailureSignatureDto analyze(String setupType, SetupDeteriorationDto deterioration,
                                       double rvol, boolean vwapHold, boolean lowerHighs) {
        String setup = SetupStatisticsService.normalize(setupType);
        List<String> patterns = new ArrayList<>();
        int score = 0;

        if (deterioration != null && deterioration.getReasons() != null) {
            for (String r : deterioration.getReasons()) {
                patterns.add(r);
                score += switch (r) {
                    case "Weakening RVOL" -> 15;
                    case "VWAP weakness" -> 20;
                    case "Lower highs forming" -> 18;
                    case "Momentum divergence" -> 16;
                    case "Setup invalidated" -> 35;
                    default -> 8;
                };
            }
        }
        if (rvol > 0 && rvol < 1.2) {
            if (!patterns.contains("Weakening RVOL")) patterns.add("Weakening RVOL");
            score += 12;
        }
        if (!vwapHold) {
            if (!patterns.contains("Failed VWAP hold")) patterns.add("Failed VWAP hold");
            score += 18;
        }
        if (lowerHighs && !patterns.contains("Lower highs forming")) {
            patterns.add("Lower highs forming");
            score += 15;
        }
        if (setup.contains("CONT") && rvol < 1.0) {
            patterns.add("Second breakout rejection risk");
            score += 10;
        }

        score = Math.min(100, score);
        String severity = score >= 60 ? "HIGH" : score >= 35 ? "ELEVATED" : "LOW";
        String message = score >= 35 ? "Failure Risk Increasing" : "Failure signatures minimal";

        return FailureSignatureDto.builder()
                .failureProbability(score)
                .severity(severity)
                .patterns(patterns)
                .message(message)
                .build();
    }
}
