package com.tradingbot.intelligence.cognition;

import com.tradingbot.api.dto.MarketMemoryDto;
import com.tradingbot.api.dto.MarketTrendDto;
import com.tradingbot.api.dto.cognition.CognitionPartDtos.SessionTemperatureDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SessionTemperatureService {

    public SessionTemperatureDto classify(MarketTrendDto trend, MarketMemoryDto memory) {
        if (trend == null) {
            return temp("LOW PARTICIPATION", "Insufficient market data.", 20);
        }

        int score = 50;
        if (trend.isRiskOn() && trend.getRiskOnScore() != null && trend.getRiskOnScore() >= 65) score += 15;
        if ("STRONG".equals(trend.getSemiBreadth())) score += 10;
        if (trend.isChoppy()) score -= 20;
        if (memory != null && memory.getEmergingSetupCount() > 5) score += 10;
        if (memory != null && memory.getContinuationSuccessRate() != null
                && memory.getContinuationSuccessRate() >= 0.6) score += 12;
        if (memory != null && memory.getOpenMomentumSuccessRate() != null
                && memory.getOpenMomentumSuccessRate() < 0.35) score -= 15;

        String label;
        String desc;
        if (score >= 75 && !trend.isChoppy()) {
            label = "HOT MOMENTUM DAY";
            desc = "Strong breadth and follow-through — momentum setups favored.";
        } else if (score >= 65 && trend.getRegime() != null && trend.getRegime().contains("TRENDING")) {
            label = "TREND EXPANSION";
            desc = "Trend persistence elevated — continuation setups working.";
        } else if (trend.isChoppy() && score < 45) {
            label = "SLOW CHOP";
            desc = "Low follow-through — reduce size, avoid extended entries.";
        } else if (memory != null && !memory.getFailingSetups().isEmpty()
                && memory.getFailingSetups().size() >= 2) {
            label = "REVERSAL HEAVY";
            desc = "Multiple setup types failing — mean-reversion or stand aside.";
        } else if (memory != null && memory.getOpenMomentumSuccessRate() != null
                && memory.getOpenMomentumSuccessRate() >= 0.6) {
            label = "GAP FOLLOW-THROUGH";
            desc = "Opening momentum delivering — early entries rewarded.";
        } else if (score < 40) {
            label = "LOW PARTICIPATION";
            desc = "Weak RVOL and breadth — wait for catalyst.";
        } else {
            label = "HIGH ROTATION";
            desc = "Sector rotation active — be selective on leaders.";
        }

        return temp(label, desc, Math.max(0, Math.min(100, score)));
    }

    private SessionTemperatureDto temp(String label, String desc, int intensity) {
        return SessionTemperatureDto.builder()
                .label(label)
                .description(desc)
                .intensity(intensity)
                .build();
    }
}
