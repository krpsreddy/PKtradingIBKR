package com.tradingbot.services;

import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Service
public class MarketHoursService {

    public static final ZoneId MARKET_ZONE = ZoneId.of("America/New_York");

    /** Opening momentum detector window (separate from regular 9:35 signal window). */
    private static final LocalTime OPEN_MOM_START = LocalTime.of(9, 30);
    private static final LocalTime OPEN_MOM_END = LocalTime.of(9, 45);
    private static final LocalTime OPEN_MOM_RANK_END = LocalTime.of(10, 0);
    private static final LocalTime OPEN_SCOUT_END = LocalTime.of(9, 40);
    private static final LocalTime OPEN_FAIL_END = LocalTime.of(11, 0);
    private static final LocalTime RECOVERY_FAIL_START = LocalTime.of(10, 30);
    private static final LocalTime RECOVERY_FAIL_END = LocalTime.of(15, 0);

    /** Signal generation window */
    private static final LocalTime SIGNAL_START = LocalTime.of(9, 35);
    private static final LocalTime SIGNAL_END = LocalTime.of(15, 30);

    /** Regular trading session (RTH) for chart display */
    private static final LocalTime RTH_OPEN = LocalTime.of(9, 30);
    private static final LocalTime RTH_CLOSE = LocalTime.of(16, 0);

    public boolean isMarketOpen() {
        return isMarketOpen(MarketTime.now());
    }

    public boolean isMarketOpen(ZonedDateTime estTime) {
        if (!isWeekday(estTime)) {
            return false;
        }
        LocalTime time = estTime.toLocalTime();
        return !time.isBefore(SIGNAL_START) && !time.isAfter(SIGNAL_END);
    }

    public boolean isOpenMomentumWindow() {
        return isOpenMomentumWindow(MarketTime.now());
    }

    public boolean isOpenMomentumWindow(ZonedDateTime estTime) {
        if (!isWeekday(estTime)) {
            return false;
        }
        LocalTime time = estTime.toLocalTime();
        return !time.isBefore(OPEN_MOM_START) && !time.isAfter(OPEN_MOM_END);
    }

    public boolean isOpenScoutWindow() {
        return isOpenScoutWindow(MarketTime.now());
    }

    public boolean isOpenScoutWindow(ZonedDateTime estTime) {
        if (!isWeekday(estTime)) {
            return false;
        }
        LocalTime time = estTime.toLocalTime();
        return !time.isBefore(OPEN_MOM_START) && time.isBefore(OPEN_SCOUT_END);
    }

    public boolean isOpenScoutRankingWindow() {
        return isOpenScoutWindow();
    }

    public boolean isOpenMomentumRankingWindow() {
        ZonedDateTime now = MarketTime.now();
        if (!isWeekday(now)) {
            return false;
        }
        LocalTime time = now.toLocalTime();
        return !time.isBefore(OPEN_MOM_START) && !time.isAfter(OPEN_MOM_RANK_END);
    }

    public boolean isOpenFailWindow() {
        return isOpenFailWindow(MarketTime.now());
    }

    public boolean isOpenFailWindow(ZonedDateTime estTime) {
        if (!isWeekday(estTime)) {
            return false;
        }
        LocalTime time = estTime.toLocalTime();
        return !time.isBefore(SIGNAL_START) && !time.isAfter(OPEN_FAIL_END);
    }

    public boolean isRecoveryFailWindow() {
        return isRecoveryFailWindow(MarketTime.now());
    }

    public boolean isRecoveryFailWindow(ZonedDateTime estTime) {
        if (!isWeekday(estTime)) {
            return false;
        }
        LocalTime time = estTime.toLocalTime();
        return !time.isBefore(RECOVERY_FAIL_START) && !time.isAfter(RECOVERY_FAIL_END);
    }

    public String getMarketStatus() {
        return isMarketOpen() ? "MARKET OPEN" : "MARKET CLOSED";
    }

    public boolean isRegularSessionCandle(LocalDateTime openTime) {
        ZonedDateTime z = MarketTime.toMarketZoned(openTime);
        if (!isWeekday(z)) {
            return false;
        }
        LocalTime t = z.toLocalTime();
        return !t.isBefore(RTH_OPEN) && t.isBefore(RTH_CLOSE);
    }

    public String formatEstNow() {
        ZonedDateTime now = MarketTime.now();
        String suffix = now.getZone().getRules().isDaylightSavings(now.toInstant()) ? "EDT" : "EST";
        return now.toLocalTime().withNano(0).toString() + " " + suffix;
    }

    /** Most recent completed regular session (ET). Before 16:00 on a weekday → prior session. */
    public LocalDate lastTradingDay() {
        return lastTradingDay(MarketTime.now());
    }

    public LocalDate lastTradingDay(ZonedDateTime estTime) {
        ZonedDateTime t = estTime.withZoneSameInstant(MARKET_ZONE);
        DayOfWeek day = t.getDayOfWeek();
        if (day == DayOfWeek.SATURDAY) {
            return t.minusDays(1).toLocalDate();
        }
        if (day == DayOfWeek.SUNDAY) {
            return t.minusDays(2).toLocalDate();
        }
        if (t.toLocalTime().isBefore(RTH_CLOSE)) {
            return previousTradingDay(t.toLocalDate());
        }
        return t.toLocalDate();
    }

    private LocalDate previousTradingDay(LocalDate date) {
        LocalDate prev = date.minusDays(1);
        while (prev.getDayOfWeek() == DayOfWeek.SATURDAY || prev.getDayOfWeek() == DayOfWeek.SUNDAY) {
            prev = prev.minusDays(1);
        }
        return prev;
    }

    private boolean isWeekday(ZonedDateTime estTime) {
        DayOfWeek day = estTime.getDayOfWeek();
        return day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY;
    }
}
