package com.tradingbot.sessionintelligence.premarket;

import org.springframework.stereotype.Component;

@Component
public class PremarketRVOLAnalyzer {

    public record RvolAnalysis(double rvol, int participationQuality, int institutionalProbability) {}

    public RvolAnalysis analyze(double estimatedRvol, Long avgDailyVolume) {
        double rvol = estimatedRvol > 0 ? estimatedRvol : 1.0;
        int quality = rvol >= 2 ? 80 : (rvol >= 1.3 ? 62 : 40);
        int inst = rvol >= 1.8 && avgDailyVolume != null && avgDailyVolume > 5_000_000 ? 75 : 45;
        if (rvol < 0.8) quality = 25;
        return new RvolAnalysis(rvol, clamp(quality), clamp(inst));
    }

    private static int clamp(int v) {
        return Math.max(0, Math.min(100, v));
    }
}
