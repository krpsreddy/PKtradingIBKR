package com.tradingbot.discovery.historical;

import java.util.Locale;

/** Phase 206 — bullish continuation regime families only. */
public final class BullishRegimeFamilyMapper {

    private BullishRegimeFamilyMapper() {}

    public static String familyFor(String regime, String setup) {
        String raw = ((regime != null ? regime : "") + " " + (setup != null ? setup : ""))
                .toUpperCase(Locale.US);
        if (raw.contains("INSTITUTIONAL") || raw.contains("PERSIST")) return "INSTITUTIONAL_PERSISTENCE";
        if (raw.contains("SHALLOW") || raw.contains("PULLBACK")) return "SHALLOW_PULLBACK_CONTINUATION";
        if (raw.contains("COMPRESSION") || raw.contains("SQUEEZE")) return "COMPRESSION_EXPANSION";
        if (raw.contains("BREAKOUT") && !raw.contains("FAILED")) return "HEALTHY_BREAKOUT";
        if (raw.contains("VWAP") && raw.contains("ACCEPT")) return "VWAP_ACCEPTANCE";
        if (raw.contains("EARLY") && raw.contains("CONT")) return "EARLY_CONTINUATION";
        if (raw.contains("TREND") && raw.contains("EXPAN")) return "TREND_EXPANSION";
        if (raw.contains("SECOND") || raw.contains("2ND") || raw.contains("2ND_LEG")) {
            return "SECOND_LEG_CONTINUATION";
        }
        if (raw.contains("CONTINUATION") || raw.contains("EXPANSION") || raw.contains("MOM")) {
            return "TREND_EXPANSION";
        }
        return "INSTITUTIONAL_PERSISTENCE";
    }
}
