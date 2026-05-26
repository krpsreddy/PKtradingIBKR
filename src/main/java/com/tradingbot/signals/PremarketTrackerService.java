package com.tradingbot.signals;

import com.tradingbot.models.Candle;
import com.tradingbot.services.MarketHoursService;
import com.tradingbot.services.MarketTime;
import com.tradingbot.symbol.SymbolContext;
import com.tradingbot.symbol.SymbolContextRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PremarketTrackerService {

    private static final LocalTime PREMARKET_START = LocalTime.of(4, 0);

    private final SymbolContextRegistry symbolContextRegistry;
    private final MarketHoursService marketHoursService;

    public void updateFromCandles(String symbol, List<Candle> candles) {
        if (candles == null || candles.isEmpty()) {
            return;
        }
        LocalDate sessionDay = MarketTime.now().toLocalDate();
        BigDecimal pmHigh = null;
        BigDecimal pmLow = null;

        for (Candle c : candles) {
            if (!isPremarketBar(c, sessionDay)) {
                continue;
            }
            pmHigh = pmHigh == null ? c.getHigh() : pmHigh.max(c.getHigh());
            pmLow = pmLow == null ? c.getLow() : pmLow.min(c.getLow());
        }

        if (pmHigh == null) {
            return;
        }

        SymbolContext ctx = symbolContextRegistry.getOrCreate(symbol);
        ctx.setPremarketSessionDate(sessionDay);
        ctx.setPremarketHigh(pmHigh);
        ctx.setPremarketLow(pmLow);
    }

    public BigDecimal getPremarketHigh(SymbolContext ctx) {
        return ctx != null ? ctx.getPremarketHigh() : null;
    }

    private boolean isPremarketBar(Candle c, LocalDate sessionDay) {
        var z = MarketTime.toMarketZoned(c.getOpenTime());
        if (!z.toLocalDate().equals(sessionDay)) {
            return false;
        }
        LocalTime t = z.toLocalTime();
        return !t.isBefore(PREMARKET_START) && marketHoursService.isRegularSessionCandle(c.getOpenTime()) == false
                && t.isBefore(LocalTime.of(9, 30));
    }

    /** Bars before 9:30 RTH on the session day (includes extended hours in stored history). */
    public static Candle findPriorRthClose(List<Candle> candles) {
        return candles.stream()
                .filter(c -> MarketTime.toMarketZoned(c.getOpenTime()).toLocalTime().isBefore(LocalTime.of(9, 30)))
                .max(Comparator.comparing(Candle::getOpenTime))
                .orElse(null);
    }
}
