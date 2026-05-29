package com.tradingbot.discovery.historical;

import org.springframework.stereotype.Component;

/**
 * Phase 204 — 0–100 confidence from consistency, survival, stability (not curve-fit).
 */
@Component
public class DiscoveryConfidenceScorer {

    public int score(int sampleCount, double winRate, double continuationPct, double failurePct) {
        if (sampleCount < 5) return Math.min(35, sampleCount * 5);
        int s = 40;
        if (sampleCount >= 15) s += 15;
        if (sampleCount >= 40) s += 10;
        if (winRate >= 55) s += 12;
        if (continuationPct >= 50) s += 10;
        if (failurePct <= 35) s += 8;
        if (winRate >= 65 && continuationPct >= 55) s += 10;
        return Math.min(100, s);
    }

    public String expectancyLabel(int score, double winRate) {
        if (score >= 75 && winRate >= 55) return "HIGH";
        if (score >= 55 && winRate >= 45) return "MEDIUM";
        if (score < 40) return "LOW_SAMPLE";
        return "MIXED";
    }
}
