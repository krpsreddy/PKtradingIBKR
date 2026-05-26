package com.tradingbot.intelligence;

import com.tradingbot.indicators.IndicatorResult;
import com.tradingbot.intelligence.dto.*;
import com.tradingbot.models.TradingSignal;
import org.springframework.stereotype.Service;

@Service
public class TradeQualityService {

    public TradeQualityDto grade(SymbolIntelligenceDto intel, RiskRewardDto rr,
                                 IndicatorResult indicators, TradingSignal signal) {
        int score = intel.getRank() != null ? intel.getRank().getRankScore() : 50;

        if (intel.getFreshness() != null) {
            score += switch (intel.getFreshness().getFreshness()) {
                case "FRESH" -> 12;
                case "ACTIVE" -> 6;
                case "AGING" -> -8;
                case "STALE" -> -18;
                default -> 0;
            };
        }

        if (intel.getMtf() != null) {
            score += (intel.getMtf().getAlignmentScore() - 50) / 5;
        }

        if (rr != null) {
            score += switch (rr.getQuality()) {
                case "STRONG" -> 10;
                case "MEDIOCRE" -> 0;
                default -> -12;
            };
        }

        if (intel.getExtended() != null && intel.getExtended().isExtended()) {
            score -= 15;
        }

        if (!intel.isRegimeAligned()) {
            score -= 10;
        }

        if (indicators != null && indicators.getRelativeVolume() != null) {
            double rvol = indicators.getRelativeVolume().doubleValue();
            if (rvol >= 2.0) score += 6;
            else if (rvol < 1.0) score -= 8;
        }

        if (signal != null && "WEAKENING".equals(signal.getLifecycleState())) {
            score -= 12;
        }

        score = Math.max(0, Math.min(100, score));
        return TradeQualityDto.builder()
                .score(score)
                .grade(toGrade(score))
                .build();
    }

    public String toGrade(int score) {
        if (score >= 88) return "A+";
        if (score >= 75) return "A";
        if (score >= 58) return "B";
        if (score >= 42) return "C";
        return "AVOID";
    }
}
