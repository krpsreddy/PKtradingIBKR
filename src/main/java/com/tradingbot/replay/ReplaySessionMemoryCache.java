package com.tradingbot.replay;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.tradingbot.api.dto.ReplayHistoryDto;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

/** Phase 193 — in-memory LRU for expensive replay session builds (DB snapshot miss path). */
@Component
public class ReplaySessionMemoryCache {

    private final Cache<String, ReplayHistoryDto> cache = Caffeine.newBuilder()
            .maximumSize(48)
            .expireAfterWrite(Duration.ofMinutes(30))
            .recordStats()
            .build();

    public Optional<ReplayHistoryDto> get(String symbol, String sessionDate, String timeframe) {
        return Optional.ofNullable(cache.getIfPresent(key(symbol, sessionDate, timeframe)));
    }

    public void put(String symbol, String sessionDate, String timeframe, ReplayHistoryDto dto) {
        if (dto != null && dto.getSessionCandles() != null && !dto.getSessionCandles().isEmpty()) {
            cache.put(key(symbol, sessionDate, timeframe), dto);
        }
    }

    public void invalidateSymbol(String symbol) {
        String prefix = symbol.toUpperCase() + "|";
        cache.asMap().keySet().removeIf(k -> k.startsWith(prefix));
    }

    public String statsSummary() {
        var s = cache.stats();
        return String.format(
                "replayMemCache hits=%d misses=%d hitRate=%.2f size=%d",
                s.hitCount(), s.missCount(), s.hitRate(), cache.estimatedSize()
        );
    }

    private static String key(String symbol, String sessionDate, String timeframe) {
        return symbol.toUpperCase() + "|" + sessionDate + "|" + (timeframe != null ? timeframe : "5MIN");
    }
}
