package com.tradingbot.discovery.historical;

import com.tradingbot.analytics.storage.entity.EvaluatedSignalSnapshotEntity;

import java.util.Locale;

/** Phase 206 — classifies snapshots for directional discovery (not inverted bullish). */
public final class DiscoveryDirectionClassifier {

    private DiscoveryDirectionClassifier() {}

    public static boolean isBearish(EvaluatedSignalSnapshotEntity e) {
        String raw = ((nz(e.getRegime()) + " " + nz(e.getSetup()) + " " + nz(e.getMarketCondition())
                + " " + nz(e.getNarrativePath()) + " " + nz(e.getDecisionReason())
                + " " + nz(e.getContinuationHealth()))).toUpperCase(Locale.US);

        if (containsAny(raw, "PUT_ASSIST", "PUT ASSIST", "BEARISH", "BREAKDOWN", "FAILED_RECLAIM",
                "FAILED RECLAIM", "VWAP_REJECT", "VWAP REJECT", "DISTRIBUTION", "PANIC_EXPANSION",
                "PANIC EXPANSION", "ACCELERATED_SELLING", "LOWER_HIGH", "LOWER HIGH",
                "EXHAUSTION_REVERSAL", "EXHAUSTION REVERSAL", "FAILED_EXPANSION", "FAILED EXPANSION",
                "REJECTION", "COLLAPSE", "SHORT", "PUT ")) {
            return true;
        }
        if (containsAny(raw, "TREND_DAY_BEAR", "FAILED_BREAKOUT", "DISTRIBUTION_ENV", "BEAR TREND")) {
            return true;
        }
        if (containsAny(raw, "BULLISH_CONTINUATION", "INSTITUTIONAL_PERSISTENCE", "SECOND_LEG",
                "SHALLOW_PULLBACK", "HEALTHY_BREAKOUT", "VWAP_ACCEPTANCE", "TREND_EXPANSION")) {
            return false;
        }
        String mc = nz(e.getMarketCondition()).toUpperCase(Locale.US);
        if (mc.contains("BEAR") || mc.contains("FAIL") && mc.contains("BREAK")) {
            return true;
        }
        return containsAny(raw, "FAILED", "EXHAUST", "REVERSAL", "RECLAIM", "REJECT");
    }

    public static boolean matches(DiscoveryDirection direction, EvaluatedSignalSnapshotEntity e) {
        boolean bearish = isBearish(e);
        return direction == DiscoveryDirection.BEARISH ? bearish : !bearish;
    }

    private static boolean containsAny(String haystack, String... needles) {
        for (String n : needles) {
            if (haystack.contains(n)) return true;
        }
        return false;
    }

    private static String nz(String s) {
        return s != null ? s : "";
    }
}
