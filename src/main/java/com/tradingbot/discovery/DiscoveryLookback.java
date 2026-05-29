package com.tradingbot.discovery;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/** Phase 203 — lookback window (trading-day approximation). */
public final class DiscoveryLookback {

    private static final ZoneId ET = ZoneId.of("America/New_York");

    private DiscoveryLookback() {}

    public static int normalizeDays(int days) {
        if (days <= 7) return 7;
        if (days <= 30) return 30;
        if (days <= 60) return 60;
        return 90;
    }

    public static Instant fromInstant(int days) {
        int d = normalizeDays(days);
        return ZonedDateTime.now(ET).minusDays(d).toInstant();
    }
}
