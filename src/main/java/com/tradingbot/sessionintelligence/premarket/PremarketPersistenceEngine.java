package com.tradingbot.sessionintelligence.premarket;

import com.tradingbot.models.Candle;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class PremarketPersistenceEngine {

    public record PersistenceAnalysis(
            int continuationSurvival,
            int trendQuality,
            int pullbackHealth,
            int accelerationConsistency
    ) {}

    public PersistenceAnalysis analyze(List<Candle> pmBars, double gapPct) {
        if (pmBars == null || pmBars.size() < 3) {
            return new PersistenceAnalysis(40, 40, 45, 40);
        }
        int up = 0;
        int orderly = 0;
        double prevClose = pmBars.get(0).getClose().doubleValue();
        for (int i = 1; i < pmBars.size(); i++) {
            double close = pmBars.get(i).getClose().doubleValue();
            if (close >= prevClose) up++;
            double body = Math.abs(close - pmBars.get(i).getOpen().doubleValue());
            double range = pmBars.get(i).getHigh().doubleValue() - pmBars.get(i).getLow().doubleValue();
            if (range > 0 && body / range < 0.65) orderly++;
            prevClose = close;
        }
        int survival = (int) Math.round(100.0 * up / (pmBars.size() - 1));
        int quality = (int) Math.round(100.0 * orderly / pmBars.size());
        int pullback = gapPct > 0 ? Math.min(100, survival + 10) : survival;
        int accel = pmBars.size() >= 5 && survival > 55 ? 65 : 45;
        return new PersistenceAnalysis(
                clamp(survival), clamp(quality), clamp(pullback), clamp(accel));
    }

    private static int clamp(int v) {
        return Math.max(0, Math.min(100, v));
    }
}
