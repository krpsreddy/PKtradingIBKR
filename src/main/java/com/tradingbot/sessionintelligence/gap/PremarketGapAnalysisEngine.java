package com.tradingbot.sessionintelligence.gap;

import com.tradingbot.sessionintelligence.premarket.PremarketTrendState;
import org.springframework.stereotype.Component;

/** Phase 211 — gap quality and sustainability. */
@Component
public class PremarketGapAnalysisEngine {

    public record GapAnalysis(
            double gapPct,
            int gapQuality,
            int sustainability,
            int exhaustionRisk,
            int fadeProbability,
            boolean goodGap,
            PremarketTrendState gapBias
    ) {}

    public GapAnalysis analyze(double gapPct, int persistence, int trendQuality, boolean vwapHeld, double rvol) {
        double abs = Math.abs(gapPct);
        int quality = 50;
        int sustain = 50;
        int exhaust = 25;
        int fade = 30;

        if (abs >= 1 && abs <= 4) quality += 20;
        if (abs > 6) {
            quality -= 15;
            exhaust += 25;
        }
        if (abs > 10) {
            exhaust += 20;
            fade += 25;
        }
        if (persistence >= 60) sustain += 20;
        if (trendQuality >= 65) sustain += 15;
        if (vwapHeld) sustain += 12;
        if (rvol >= 1.5) quality += 10;
        if (persistence < 40) fade += 20;

        quality = clamp(quality);
        sustain = clamp(sustain);
        exhaust = clamp(exhaust);
        fade = clamp(fade);

        boolean good = quality >= 60 && sustain >= 55 && exhaust < 55;
        PremarketTrendState bias = gapPct < -2 && !vwapHeld
                ? PremarketTrendState.FAILED_GAP
                : (exhaust >= 65 ? PremarketTrendState.PARABOLIC_EXTENSION
                : (good ? PremarketTrendState.HEALTHY_CONTINUATION : PremarketTrendState.WEAK_DRIFT));

        return new GapAnalysis(gapPct, quality, sustain, exhaust, fade, good, bias);
    }

    private static int clamp(int v) {
        return Math.max(0, Math.min(100, v));
    }
}
