package com.tradingbot.intelligence.execution.realtime;

import com.tradingbot.symbol.SymbolContext;

import java.util.ArrayList;
import java.util.List;

/** Stage 1 — lightweight 1s anomaly detection (no full rescoring). */
public final class NanoAnomalyDetector {

    private NanoAnomalyDetector() {}

    public record NanoAnomalyResult(
            String symbol,
            boolean anomalyDetected,
            String opportunityType,
            int anomalyScore,
            List<String> signals
    ) {}

    public static NanoAnomalyResult detect(SymbolContext ctx, SymbolTickState tick) {
        List<String> signals = new ArrayList<>();
        int score = 0;
        String type = "EARLY_EXPANSION";

        double rvol = ctx.getLiveEstimatedRvol() != null ? ctx.getLiveEstimatedRvol() : 0;
        double prevRvol = tick.lastRvol();
        if (rvol >= 1.5) {
            score += 12;
            signals.add("RVOL " + String.format("%.1fx", rvol));
            if (rvol - prevRvol >= 0.3) {
                score += 15;
                signals.add("RVOL acceleration");
            }
        }

        if (ctx.getLastPrice() != null && ctx.getLiveVwap() != null) {
            double price = ctx.getLastPrice();
            double vwap = ctx.getLiveVwap().doubleValue();
            if (price >= vwap * 0.998) {
                score += 10;
                signals.add("VWAP acceptance");
                type = "VWAP_PERSISTENCE";
            }
        }

        if (ctx.getOpeningRangeHigh() != null && ctx.getLastPrice() != null) {
            double orh = ctx.getOpeningRangeHigh().doubleValue();
            if (ctx.getLastPrice() >= orh * 0.999) {
                score += 14;
                signals.add("micro breakout pressure");
                type = "COMPRESSION_RELEASE";
            }
        }

        Double body = ctx.getLiveBodyStrength();
        if (body != null && body < 0.35 && rvol >= 1.2) {
            score += 8;
            signals.add("compression tightening");
        }

        String readiness = ctx.getReadinessState();
        if (readiness != null && readiness.contains("CONT")) {
            score += 12;
            signals.add("continuation integrity");
            type = "SHALLOW_PULLBACK_CONTINUATION";
        }

        if ("bullish".equalsIgnoreCase(ctx.getTrend()) && rvol >= 2.0) {
            score += 10;
            signals.add("participation expansion");
        }

        if (ctx.getGapPercent() != null && ctx.getGapPercent() > 1.5 && rvol >= 1.8) {
            score += 6;
            signals.add("range expansion");
        }

        // Exhaustion proxy
        if (body != null && body > 0.85 && rvol < 1.2) {
            score -= 20;
            type = "LATE_STAGE_EXHAUSTION";
            signals.add("exhaustion drift");
        }

        boolean detected = score >= 18;
        return new NanoAnomalyResult(ctx.getSymbol(), detected, type, Math.max(0, Math.min(100, score)), signals);
    }
}
