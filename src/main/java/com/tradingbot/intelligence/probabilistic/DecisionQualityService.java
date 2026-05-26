package com.tradingbot.intelligence.probabilistic;

import com.tradingbot.api.dto.probabilistic.ProbabilisticExecutionDtos.DecisionQualityDto;
import com.tradingbot.intelligence.dto.ExecutionIntelligenceDto;
import org.springframework.stereotype.Service;

@Service
public class DecisionQualityService {

    public DecisionQualityDto evaluate(String setupType, ExecutionIntelligenceDto exec,
                                       String entryQuality, boolean regimeAligned) {
        int score = 50;
        if (exec != null && exec.getTradeQuality() != null) {
            String grade = exec.getTradeQuality().getGrade();
            score += switch (grade != null ? grade : "C") {
                case "A+" -> 30;
                case "A" -> 25;
                case "B" -> 10;
                case "C" -> -5;
                default -> -15;
            };
        }
        if ("GOOD".equals(entryQuality) || "EARLY".equals(entryQuality)) score += 15;
        if ("LATE".equals(entryQuality) || "CHASING".equals(entryQuality)) score -= 20;
        if (regimeAligned) score += 10;
        if (exec != null && exec.getDeterioration() != null) {
            if ("FAILING".equals(exec.getDeterioration().getState())) score -= 25;
            else if ("WEAKENING".equals(exec.getDeterioration().getState())) score -= 10;
        }

        score = Math.max(0, Math.min(100, score));
        String label;
        String detail;
        if (score >= 70) {
            label = "GOOD_DECISION";
            detail = "Setup quality, regime alignment, and entry timing support edge";
        } else if (score >= 45) {
            label = "LOW_QUALITY_DECISION";
            detail = "Mixed signals — edge uncertain, reduce size";
        } else if ("CHASING".equals(entryQuality)) {
            label = "LUCKY_WIN";
            detail = "Poor entry quality — outcome may not reflect decision quality";
        } else {
            label = "DISCIPLINED_LOSS";
            detail = "Acceptable loss if rules were followed — review process not outcome";
        }

        return DecisionQualityDto.builder()
                .label(label)
                .detail(detail)
                .score(score)
                .build();
    }
}
