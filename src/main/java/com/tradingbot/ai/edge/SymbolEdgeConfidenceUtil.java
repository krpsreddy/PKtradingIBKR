package com.tradingbot.ai.edge;

/** Sample-size confidence tiers for symbol edge analysis (Phase 132). */
public final class SymbolEdgeConfidenceUtil {

    private SymbolEdgeConfidenceUtil() {}

    public static String label(int sampleCount) {
        if (sampleCount < 10) return "LOW";
        if (sampleCount < 25) return "MEDIUM";
        if (sampleCount < 50) return "HIGH";
        return "VERY_HIGH";
    }

    public static double score(int sampleCount) {
        if (sampleCount < 10) return 0.35;
        if (sampleCount < 25) return 0.55;
        if (sampleCount < 50) return 0.72;
        return 0.88;
    }
}
