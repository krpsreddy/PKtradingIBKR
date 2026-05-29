package com.tradingbot.sessionintelligence.context;

import com.tradingbot.models.Candle;
import com.tradingbot.sessionintelligence.session.PremarketSessionWindow;
import com.tradingbot.services.MarketTime;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Phase 211 — in-memory PM candles (same day, 9:00–9:30 only). */
@Component
public class PremarketCandleRollingStore {

    private static final int MAX_BARS = 36;
    private final Map<String, List<Candle>> bySymbol = new ConcurrentHashMap<>();
    private volatile String sessionKey = "";

    public void resetIfSessionChanged(String newSessionKey) {
        if (newSessionKey != null && !newSessionKey.equals(sessionKey)) {
            bySymbol.clear();
            sessionKey = newSessionKey;
        }
    }

    public void ingest(String symbol, List<Candle> candles) {
        if (candles == null || candles.isEmpty()) return;
        LocalDate day = MarketTime.now().toLocalDate();
        List<Candle> filtered = new ArrayList<>();
        for (Candle c : candles) {
            if (isActiveWindowBar(c, day)) {
                filtered.add(c);
            }
        }
        if (filtered.isEmpty()) return;
        bySymbol.put(symbol.toUpperCase(), cap(filtered));
    }

    public List<Candle> bars(String symbol) {
        return bySymbol.getOrDefault(symbol.toUpperCase(), List.of());
    }

    private static boolean isActiveWindowBar(Candle c, LocalDate sessionDay) {
        ZonedDateTime z = MarketTime.toMarketZoned(c.getOpenTime());
        if (!z.toLocalDate().equals(sessionDay)) return false;
        LocalTime t = z.toLocalTime();
        return !t.isBefore(PremarketSessionWindow.ACTIVE_START)
                && t.isBefore(PremarketSessionWindow.ACTIVE_END);
    }

    private static List<Candle> cap(List<Candle> bars) {
        if (bars.size() <= MAX_BARS) return new ArrayList<>(bars);
        return new ArrayList<>(bars.subList(bars.size() - MAX_BARS, bars.size()));
    }
}
