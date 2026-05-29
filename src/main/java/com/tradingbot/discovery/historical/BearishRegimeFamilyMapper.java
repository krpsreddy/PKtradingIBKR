package com.tradingbot.discovery.historical;

import java.util.Locale;

/** Phase 206 — bearish breakdown / PUT assist regime families only. */
public final class BearishRegimeFamilyMapper {

    private BearishRegimeFamilyMapper() {}

    public static String familyFor(String regime, String setup) {
        String raw = ((regime != null ? regime : "") + " " + (setup != null ? setup : ""))
                .toUpperCase(Locale.US);
        if (raw.contains("FAILED") && raw.contains("RECLAIM")) return "FAILED_RECLAIM";
        if (raw.contains("VWAP") && (raw.contains("REJECT") || raw.contains("FAIL"))) return "VWAP_REJECTION";
        if (raw.contains("BREAKDOWN") && raw.contains("CONFIRM")) return "BREAKDOWN_CONFIRMATION";
        if (raw.contains("DISTRIBUTION")) return "DISTRIBUTION_BREAKDOWN";
        if (raw.contains("FAILED") && raw.contains("EXPANSION")) return "FAILED_EXPANSION";
        if (raw.contains("EXHAUST") || raw.contains("REVERSAL")) return "EXHAUSTION_REVERSAL";
        if (raw.contains("PANIC")) return "PANIC_EXPANSION";
        if (raw.contains("ACCELERAT") || raw.contains("SELL")) return "ACCELERATED_SELLING";
        if (raw.contains("BREAKDOWN") || raw.contains("FAIL")) return "BREAKDOWN_CONFIRMATION";
        if (raw.contains("REJECT") || raw.contains("RECLAIM")) return "FAILED_RECLAIM";
        return "BREAKDOWN_CONFIRMATION";
    }
}
