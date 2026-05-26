package com.tradingbot.intelligence.snapshot;

import java.util.Locale;
import java.util.Map;

/** Phase 170 — human labels for autonomous opportunity taxonomy (replaces legacy signalType display). */
public final class AutonomousDisplayMapper {

    private static final Map<String, String> LEGACY_TO_REGIME = Map.ofEntries(
            Map.entry("OPEN_MOM_BUY", "EARLY_EXPANSION"),
            Map.entry("OPEN_SCOUT", "EARLY_EXPANSION"),
            Map.entry("OPEN_READY", "EARLY_EXPANSION"),
            Map.entry("IMBALANCE_UP", "EARLY_EXPANSION"),
            Map.entry("MOM_BUY", "PERSISTENT_CONTINUATION"),
            Map.entry("CONT_BUY", "PERSISTENT_CONTINUATION"),
            Map.entry("CONT_READY", "PERSISTENT_CONTINUATION"),
            Map.entry("PULL_BUY", "SHALLOW_PULLBACK_CONTINUATION"),
            Map.entry("VWAP_RECLAIM", "VWAP_ACCEPTANCE"),
            Map.entry("OPEN_FAIL", "FAILED_EXPANSION"),
            Map.entry("OPEN_FAIL_BREAK", "FAILED_EXPANSION"),
            Map.entry("RECOVERY_FAIL", "FAILED_EXPANSION"),
            Map.entry("IMBALANCE_DOWN", "FAILED_EXPANSION"),
            Map.entry("EXIT", "EXHAUSTION_DRIFT")
    );

    private static final Map<String, String> REGIME_LABELS = Map.of(
            "EARLY_EXPANSION", "Early Expansion",
            "PERSISTENT_CONTINUATION", "Persistent Continuation",
            "FAILED_EXPANSION", "Failed Expansion",
            "VWAP_ACCEPTANCE", "VWAP Acceptance",
            "SHALLOW_PULLBACK_CONTINUATION", "Healthy Pullback Continuation",
            "COMPRESSION_BREAKOUT", "Compression Breakout",
            "ACCELERATION_INTEGRITY", "Acceleration Integrity",
            "LATE_EXTENSION", "Late Extension",
            "EXHAUSTION_DRIFT", "Exhaustion Drift",
            "REGIME_TRANSITION", "Regime Transition"
    );

    private static final Map<String, String> OPPORTUNITY_LABELS = Map.of(
            "EARLY_CONTINUATION", "Early Continuation",
            "SHALLOW_PULLBACK_CONTINUATION", "Healthy Pullback Continuation",
            "VWAP_PERSISTENCE", "VWAP Persistence",
            "INSTITUTIONAL_ACCELERATION", "Institutional Acceleration",
            "COMPRESSION_RELEASE", "Compression Release",
            "TREND_RESUMPTION", "Trend Resumption",
            "LATE_STAGE_EXHAUSTION", "Late-Stage Exhaustion"
    );

    private AutonomousDisplayMapper() {}

    public static String resolveRegimeCode(String signalType, String narrative) {
        String raw = (narrative != null ? narrative : signalType != null ? signalType : "").toUpperCase(Locale.US);
        if (raw.contains("EARLY") && raw.contains("EXPANSION")) return "EARLY_EXPANSION";
        if (raw.contains("SHALLOW") || raw.contains("PULLBACK")) return "SHALLOW_PULLBACK_CONTINUATION";
        if (raw.contains("VWAP")) return "VWAP_ACCEPTANCE";
        if (raw.contains("COMPRESSION")) return "COMPRESSION_BREAKOUT";
        if (raw.contains("EXHAUSTION")) return "EXHAUSTION_DRIFT";
        if (raw.contains("INSTITUTIONAL") || raw.contains("PERSISTENCE")) return "PERSISTENT_CONTINUATION";
        if (raw.contains("ACCELERATION")) return "ACCELERATION_INTEGRITY";
        String key = signalType != null ? signalType.toUpperCase(Locale.US) : "";
        return LEGACY_TO_REGIME.getOrDefault(key, "PERSISTENT_CONTINUATION");
    }

    public static String regimeLabel(String signalType, String narrative) {
        return REGIME_LABELS.getOrDefault(resolveRegimeCode(signalType, narrative), "Persistent Continuation");
    }

    public static String opportunityLabel(String opportunityType) {
        if (opportunityType == null || opportunityType.isBlank()) return "Unknown";
        String key = opportunityType.toUpperCase(Locale.US);
        return OPPORTUNITY_LABELS.getOrDefault(key, titleCase(key));
    }

    public static String traderActionLabel(String action) {
        if (action == null || action.isBlank()) return "WATCH";
        return action.toUpperCase(Locale.US);
    }

    public static boolean isExecutableAction(String action) {
        String a = traderActionLabel(action);
        return "ENTER".equals(a) || "ADD".equals(a);
    }

    private static String titleCase(String raw) {
        String[] parts = raw.toLowerCase(Locale.US).split("_");
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p.isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(Character.toUpperCase(p.charAt(0))).append(p.substring(1));
        }
        return sb.length() > 0 ? sb.toString() : raw;
    }
}
