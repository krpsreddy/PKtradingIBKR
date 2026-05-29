package com.tradingbot.sessionintelligence.session;

import com.tradingbot.services.MarketTime;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.ZonedDateTime;

/** Phase 211 — active PM intelligence window 9:00–9:30 ET only. */
@Component
public class PremarketSessionWindow {

    public static final LocalTime ACTIVE_START = LocalTime.of(9, 0);
    public static final LocalTime ACTIVE_END = LocalTime.of(9, 30);
    public static final LocalTime RTH_OPEN = LocalTime.of(9, 30);

    public boolean isActivePremarketIntelligenceWindow() {
        ZonedDateTime now = MarketTime.now();
        if (!isWeekday(now)) return false;
        LocalTime t = now.toLocalTime();
        return !t.isBefore(ACTIVE_START) && t.isBefore(ACTIVE_END);
    }

    public boolean isOpenTransitionWindow() {
        ZonedDateTime now = MarketTime.now();
        if (!isWeekday(now)) return false;
        LocalTime t = now.toLocalTime();
        return !t.isBefore(RTH_OPEN) && t.isBefore(LocalTime.of(10, 0));
    }

    public int minutesSinceActivePmStart() {
        ZonedDateTime now = MarketTime.now();
        LocalTime t = now.toLocalTime();
        if (t.isBefore(ACTIVE_START)) return 0;
        if (!t.isBefore(ACTIVE_END)) return 30;
        return (int) java.time.Duration.between(ACTIVE_START, t).toMinutes();
    }

    public int minutesSinceRthOpen() {
        ZonedDateTime now = MarketTime.now();
        LocalTime t = now.toLocalTime();
        if (t.isBefore(RTH_OPEN)) return 0;
        return (int) java.time.Duration.between(RTH_OPEN, t).toMinutes();
    }

    private static boolean isWeekday(ZonedDateTime z) {
        DayOfWeek d = z.getDayOfWeek();
        return d != DayOfWeek.SATURDAY && d != DayOfWeek.SUNDAY;
    }
}
