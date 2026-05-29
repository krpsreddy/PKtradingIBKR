package com.tradingbot.intelligence.live;

import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;

/** Session-aware ET clock for live scanner (no prior-day carryover). */
@Component
public class MarketSessionClock {

    private static final LocalTime RTH_OPEN = LocalTime.of(9, 30);

    private final MarketHoursService marketHoursService;

    public MarketSessionClock(MarketHoursService marketHoursService) {
        this.marketHoursService = marketHoursService;
    }

    public ZonedDateTime nowEt() {
        return MarketTime.now();
    }

    /** Active RTH session date key — resets scanner state at open. */
    public String sessionDayKey() {
        ZonedDateTime now = nowEt();
        if (marketHoursService.isMarketOpen(now)) {
            return now.toLocalDate().toString();
        }
        return marketHoursService.lastTradingDay(now).toString();
    }

    public LocalDate sessionDate() {
        return LocalDate.parse(sessionDayKey());
    }

    public int sessionMinutesSinceRthOpen() {
        ZonedDateTime now = nowEt();
        if (!marketHoursService.isMarketOpen(now)) {
            return 0;
        }
        LocalTime t = now.toLocalTime();
        if (t.isBefore(RTH_OPEN)) {
            return 0;
        }
        return (int) java.time.Duration.between(RTH_OPEN, t).toMinutes();
    }

    public String windowLabel(int sessionMinutes) {
        if (sessionMinutes <= 0) {
            return marketHoursService.isMarketOpen() ? "PRE-RTH" : "CLOSED";
        }
        if (sessionMinutes <= 15) return "OPENING";
        if (sessionMinutes <= 60) return "MORNING";
        if (sessionMinutes <= 210) return "MIDDAY";
        return "AFTERNOON";
    }

    public boolean sessionChanged(String priorKey) {
        return priorKey == null || !sessionDayKey().equals(priorKey);
    }
}
