package com.tradingbot.sessionintelligence.vwap;

import com.tradingbot.models.Candle;
import org.springframework.stereotype.Component;

import java.util.List;

/** Phase 211 — PM VWAP integrity (9:00–9:30 bars). */
@Component
public class PremarketVWAPEngine {

    public record VwapAnalysis(
            double vwap,
            boolean integrityHeld,
            boolean reclaimAbove,
            boolean rejectionBelow,
            int persistenceAroundVwap
    ) {}

    public VwapAnalysis analyze(List<Candle> pmBars, double lastPrice) {
        if (pmBars == null || pmBars.isEmpty() || lastPrice <= 0) {
            return new VwapAnalysis(lastPrice, false, false, false, 0);
        }
        double pv = 0;
        double vol = 0;
        int above = 0;
        for (Candle c : pmBars) {
            double tp = (c.getHigh().doubleValue() + c.getLow().doubleValue() + c.getClose().doubleValue()) / 3.0;
            double v = c.getVolume() != null ? c.getVolume().doubleValue() : 1;
            pv += tp * v;
            vol += v;
            if (c.getClose().doubleValue() >= tp) above++;
        }
        double vwap = vol > 0 ? pv / vol : lastPrice;
        boolean reclaim = lastPrice > vwap * 1.001;
        boolean reject = lastPrice < vwap * 0.998;
        int persist = pmBars.isEmpty() ? 0 : (int) Math.round(100.0 * above / pmBars.size());
        boolean held = lastPrice >= vwap * 0.995 && persist >= 45;
        return new VwapAnalysis(vwap, held, reclaim, reject, persist);
    }
}
