package com.tradingbot.intelligence.execution.realtime;

import com.tradingbot.symbol.SymbolContext;

/** Stage 3 — structural regime validation (lighter than full replay). */
public final class StructuralRegimeValidator {

    private StructuralRegimeValidator() {}

    public record StructuralResult(boolean passed, int integrityScore, String regimeLabel) {}

    public static StructuralResult validate(SymbolContext ctx, String opportunityType) {
        int integrity = 50;
        String regime = "NEUTRAL";

        if ("bullish".equalsIgnoreCase(ctx.getTrend())) {
            integrity += 15;
            regime = "TREND";
        }
        if (ctx.getLiveEstimatedRvol() != null && ctx.getLiveEstimatedRvol() >= 2.0) integrity += 10;
        if (ctx.getReadinessState() != null && !ctx.getReadinessState().isBlank()) integrity += 8;

        String type = opportunityType != null ? opportunityType.toUpperCase() : "";
        if (type.contains("EXHAUSTION")) {
            integrity = Math.max(20, integrity - 25);
            regime = "EXHAUSTING";
        }
        if (type.contains("VWAP") && ctx.getLiveVwap() != null && ctx.getLastPrice() != null) {
            if (ctx.getLastPrice() >= ctx.getLiveVwap().doubleValue()) integrity += 10;
        }

        integrity = Math.max(0, Math.min(100, integrity));
        boolean passed = integrity >= 55 || type.contains("EXHAUSTION");
        return new StructuralResult(passed, integrity, regime);
    }
}
