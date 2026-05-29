package com.tradingbot.discovery.historical;

import org.springframework.stereotype.Component;

/** Phase 206 — bearish-specific confidence (breakdown survival, not continuation). */
@Component
public class BearishDiscoveryConfidenceScorer {

    public int score(int sampleCount, double winRate, double breakdownSurvivalPct, double squeezeRiskAvg) {
        if (sampleCount < 5) return Math.min(35, sampleCount * 5);
        int s = 38;
        if (sampleCount >= 15) s += 14;
        if (sampleCount >= 40) s += 10;
        if (winRate >= 52) s += 12;
        if (breakdownSurvivalPct >= 48) s += 12;
        if (squeezeRiskAvg <= 35) s += 8;
        if (winRate >= 60 && breakdownSurvivalPct >= 55) s += 10;
        return Math.min(100, s);
    }

    public String expectancyLabel(int score, double winRate) {
        if (score >= 75 && winRate >= 52) return "HIGH_BREAKDOWN";
        if (score >= 55 && winRate >= 42) return "MEDIUM";
        if (score < 40) return "LOW_SAMPLE";
        return "SQUEEZE_CAUTION";
    }
}
