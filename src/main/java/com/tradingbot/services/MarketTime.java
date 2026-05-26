package com.tradingbot.services;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * All market timestamps are interpreted and stored as America/New_York wall-clock times.
 */
public final class MarketTime {

    public static final ZoneId MARKET_ZONE = MarketHoursService.MARKET_ZONE;
    public static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private MarketTime() {
    }

    public static ZonedDateTime now() {
        return ZonedDateTime.now(MARKET_ZONE);
    }

    public static LocalDateTime nowLocal() {
        return now().toLocalDateTime();
    }

    /** Treat naive DB time as Eastern wall clock. */
    public static ZonedDateTime toMarketZoned(LocalDateTime local) {
        return local.atZone(MARKET_ZONE);
    }

    public static String formatIso(LocalDateTime local) {
        return toMarketZoned(local).format(ISO);
    }

    public static String formatIsoNow() {
        return now().format(ISO);
    }

    public static LocalDateTime fromInstant(Instant instant) {
        return LocalDateTime.ofInstant(instant, MARKET_ZONE);
    }

    public static Instant toInstant(LocalDateTime local) {
        return toMarketZoned(local).toInstant();
    }
}
